import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  computeServerPhoneKey,
  maskMobileNumber,
  normalizeIndianMobileLast10,
  SlidingWindowRateLimiter,
  verifyFirebaseAdminIdToken,
  verifyRazorpaySignature,
} from './server/securityUtils.ts';

const PORT = Number(process.env.PORT) || 3000;
const BOOTSTRAPPED_ADMIN_EMAIL = 'rakeshpatel144589@gmail.com';

function readFirebaseProjectId(): string {
  try {
    const raw = fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    return parsed.projectId || 'mercurial-region-hct7q';
  } catch {
    return 'mercurial-region-hct7q';
  }
}

const FIREBASE_PROJECT_ID = readFirebaseProjectId();
const rateLimiter = new SlidingWindowRateLimiter();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getRazorpayCredentials(): { keyId: string; keySecret: string } {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  return { keyId, keySecret };
}

function buildRazorpayAuthHeader(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    const { keyId, keySecret } = getRazorpayCredentials();
    res.json({
      ok: true,
      razorpayConfigured: Boolean(keyId && keySecret),
    });
  });

  // Rate-limited phone lookup resolver -> returns hashed phoneKey for live Firestore onSnapshot
  app.post('/api/orders/lookup-phone', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const body = (req.body || {}) as { mobile?: string; honeypot?: string };

    if (typeof body.honeypot === 'string' && body.honeypot.trim().length > 0) {
      res.status(400).json({ error: 'Invalid lookup request.' });
      return;
    }

    const ipLimit = rateLimiter.check(`lookup-ip:${ip}`, 25, 60_000);
    if (!ipLimit.allowed) {
      res.setHeader('Retry-After', String(ipLimit.retryAfterSeconds));
      res.status(429).json({
        error: `Too many order lookups. Please wait ${ipLimit.retryAfterSeconds} seconds and try again.`,
      });
      return;
    }

    const mobileLast10 = normalizeIndianMobileLast10(body.mobile || '');
    if (!mobileLast10) {
      res.status(400).json({
        error: 'Please enter a valid 10-digit WhatsApp mobile number.',
      });
      return;
    }

    const phoneKey = computeServerPhoneKey(mobileLast10);
    const phoneLimit = rateLimiter.check(`lookup-phone:${phoneKey}`, 15, 60_000);
    if (!phoneLimit.allowed) {
      res.setHeader('Retry-After', String(phoneLimit.retryAfterSeconds));
      res.status(429).json({
        error: `Lookup rate limit reached for this number. Retry in ${phoneLimit.retryAfterSeconds}s.`,
      });
      return;
    }

    res.json({
      phoneKey,
      maskedMobile: maskMobileNumber(mobileLast10),
    });
  });

  // Publishable Razorpay capability check (never exposes keySecret)
  app.get('/api/payments/razorpay/config', (_req: Request, res: Response) => {
    const { keyId, keySecret } = getRazorpayCredentials();
    res.json({
      configured: Boolean(keyId && keySecret),
      keyId: keyId && keySecret ? keyId : '',
    });
  });

  // Creates a real Razorpay Order server-side before launching Razorpay Checkout
  app.post('/api/payments/razorpay/create-order', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const limit = rateLimiter.check(`rzp-create:${ip}`, 20, 60_000);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      res.status(429).json({ error: 'Too many payment attempts. Please wait a moment.' });
      return;
    }

    const { keyId, keySecret } = getRazorpayCredentials();
    if (!keyId || !keySecret) {
      res.status(503).json({
        error:
          'Razorpay server credentials are not configured yet. Please pay using Scan & Pay QR / UPI Payment, or add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server environment secrets.',
        code: 'RAZORPAY_NOT_CONFIGURED',
      });
      return;
    }

    const body = (req.body || {}) as {
      amountInInr?: number;
      receipt?: string;
      serviceName?: string;
      customerName?: string;
    };

    const amountInInr = Math.round(Number(body.amountInInr) || 0);
    if (amountInInr < 1 || amountInInr > 1_000_000) {
      res.status(400).json({ error: 'Invalid payable amount for Razorpay checkout.' });
      return;
    }

    const receipt = String(body.receipt || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\-_]/g, '')
      .slice(0, 40);

    if (receipt.length < 4) {
      res.status(400).json({ error: 'Valid order receipt ID is required.' });
      return;
    }

    try {
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: buildRazorpayAuthHeader(keyId, keySecret),
        },
        body: JSON.stringify({
          amount: amountInInr * 100,
          currency: 'INR',
          receipt,
          payment_capture: 1,
          notes: {
            serviceName: String(body.serviceName || '').slice(0, 100),
            customerName: String(body.customerName || '').slice(0, 80),
          },
        }),
      });

      const rzpJson = (await rzpRes.json()) as {
        id?: string;
        amount?: number;
        currency?: string;
        error?: { description?: string };
      };

      if (!rzpRes.ok || !rzpJson.id) {
        res.status(502).json({
          error: rzpJson.error?.description || 'Failed to initialize Razorpay order.',
        });
        return;
      }

      res.json({
        razorpayOrderId: rzpJson.id,
        amountPaise: rzpJson.amount ?? amountInInr * 100,
        currency: rzpJson.currency || 'INR',
        keyId,
      });
    } catch {
      res.status(502).json({ error: 'Unable to reach Razorpay payment gateway right now.' });
    }
  });

  // Verifies HMAC-SHA256 signature AND checks live Razorpay Payments API for captured status
  app.post('/api/payments/razorpay/verify', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const limit = rateLimiter.check(`rzp-verify:${ip}`, 25, 60_000);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      res.status(429).json({ error: 'Too many verification attempts. Please wait a moment.' });
      return;
    }

    const { keyId, keySecret } = getRazorpayCredentials();
    if (!keyId || !keySecret) {
      res.status(503).json({ error: 'Razorpay verification is not configured on the server.' });
      return;
    }

    const body = (req.body || {}) as {
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
      expectedAmountInInr?: number;
    };

    const razorpayOrderId = String(body.razorpayOrderId || '').trim();
    const razorpayPaymentId = String(body.razorpayPaymentId || '').trim();
    const razorpaySignature = String(body.razorpaySignature || '').trim();
    const expectedAmountInInr = Math.round(Number(body.expectedAmountInInr) || 0);

    if (
      !/^order_[A-Za-z0-9]{6,40}$/.test(razorpayOrderId) ||
      !/^pay_[A-Za-z0-9]{6,40}$/.test(razorpayPaymentId) ||
      expectedAmountInInr < 1
    ) {
      res.status(400).json({ error: 'Invalid Razorpay payment verification payload.' });
      return;
    }

    const sigValid = verifyRazorpaySignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      keySecret,
    });

    if (!sigValid) {
      res.status(400).json({ error: 'Razorpay signature verification failed.' });
      return;
    }

    try {
      const authHeader = buildRazorpayAuthHeader(keyId, keySecret);
      const payRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpayPaymentId}`, {
        headers: { Authorization: authHeader },
      });

      if (!payRes.ok) {
        res.status(502).json({ error: 'Unable to confirm payment status with Razorpay API.' });
        return;
      }

      let paymentData = (await payRes.json()) as {
        id?: string;
        order_id?: string;
        status?: string;
        amount?: number;
        currency?: string;
        method?: string;
      };

      if (
        paymentData.order_id !== razorpayOrderId ||
        paymentData.currency !== 'INR' ||
        paymentData.amount !== expectedAmountInInr * 100
      ) {
        res.status(400).json({ error: 'Razorpay payment details do not match order amount.' });
        return;
      }

      if (paymentData.status === 'authorized') {
        const capRes = await fetch(
          `https://api.razorpay.com/v1/payments/${razorpayPaymentId}/capture`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: authHeader,
            },
            body: JSON.stringify({
              amount: expectedAmountInInr * 100,
              currency: 'INR',
            }),
          }
        );
        if (capRes.ok) {
          paymentData = (await capRes.json()) as typeof paymentData;
        }
      }

      if (paymentData.status !== 'captured') {
        res.status(400).json({
          error: `Payment is not captured yet (current status: ${paymentData.status || 'unknown'}).`,
        });
        return;
      }

      res.json({
        verified: true,
        paymentStatus: 'PAYMENT VERIFIED',
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        method: paymentData.method || 'razorpay',
      });
    } catch {
      res.status(502).json({ error: 'Payment gateway verification request failed.' });
    }
  });

  // Admin-only live Razorpay payment lookup from Admin Dashboard
  app.post('/api/payments/razorpay/verify-admin', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Admin authentication required.' });
      return;
    }

    try {
      await verifyFirebaseAdminIdToken(token, FIREBASE_PROJECT_ID, BOOTSTRAPPED_ADMIN_EMAIL);
    } catch (err) {
      res.status(403).json({
        error: err instanceof Error ? err.message : 'Admin verification failed.',
      });
      return;
    }

    const { keyId, keySecret } = getRazorpayCredentials();
    if (!keyId || !keySecret) {
      res.status(503).json({ error: 'Razorpay server keys are not configured.' });
      return;
    }

    const body = (req.body || {}) as { razorpayPaymentId?: string };
    const paymentId = String(body.razorpayPaymentId || '').trim();
    if (!/^pay_[A-Za-z0-9]{6,40}$/.test(paymentId)) {
      res.status(400).json({ error: 'Invalid Razorpay Payment ID.' });
      return;
    }

    try {
      const payRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        headers: { Authorization: buildRazorpayAuthHeader(keyId, keySecret) },
      });
      const payData = (await payRes.json()) as {
        id?: string;
        status?: string;
        amount?: number;
        currency?: string;
        method?: string;
        error?: { description?: string };
      };
      if (!payRes.ok) {
        res.status(502).json({
          error: payData.error?.description || 'Failed to fetch payment from Razorpay.',
        });
        return;
      }
      res.json({
        id: payData.id,
        status: payData.status,
        amountInInr: Math.round((Number(payData.amount) || 0) / 100),
        currency: payData.currency || 'INR',
        method: payData.method || '',
      });
    } catch {
      res.status(502).json({ error: 'Unable to reach Razorpay API.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`gurudev_designs server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
