import crypto from 'node:crypto';

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, number[]>();

  public check(key: string, maxRequests: number, windowMs: number, nowMs = Date.now()): RateLimitDecision {
    const cutoff = nowMs - windowMs;
    const existing = this.buckets.get(key) || [];
    const active = existing.filter((ts) => ts > cutoff);

    if (active.length >= maxRequests) {
      const oldest = active[0] ?? nowMs;
      const retryAfterMs = Math.max(1000, oldest + windowMs - nowMs);
      this.buckets.set(key, active);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }

    active.push(nowMs);
    this.buckets.set(key, active);

    // Occasional cleanup to bound memory usage
    if (this.buckets.size > 2000) {
      for (const [bucketKey, timestamps] of this.buckets.entries()) {
        if (timestamps.length === 0 || timestamps[timestamps.length - 1] <= cutoff) {
          this.buckets.delete(bucketKey);
        }
      }
    }

    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - active.length),
      retryAfterSeconds: 0,
    };
  }
}

export function normalizeIndianMobileLast10(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 24 || !/^[0-9+\-\s()]+$/.test(trimmed)) {
    return null;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length >= 10 && digits.length <= 15) return digits.slice(-10);
  return null;
}

export function computeServerPhoneKey(mobileLast10: string): string {
  return crypto.createHash('sha256').update(`gd-phone-v1:${mobileLast10}`).digest('hex');
}

export function maskMobileNumber(mobileLast10: string): string {
  if (mobileLast10.length < 4) return '******';
  return `+91 ******${mobileLast10.slice(-4)}`;
}

export function verifyRazorpaySignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  keySecret: string;
}): boolean {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, keySecret } = params;
  if (
    !razorpayOrderId ||
    !razorpayPaymentId ||
    !razorpaySignature ||
    !keySecret ||
    !/^[a-f0-9]{64}$/i.test(razorpaySignature)
  ) {
    return false;
  }
  const expectedHex = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const providedBuf = Buffer.from(razorpaySignature.toLowerCase(), 'hex');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

interface CertCache {
  certs: Record<string, string>;
  expiresAtMs: number;
}

let googleCertCache: CertCache | null = null;

async function fetchGoogleSecureTokenCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (googleCertCache && googleCertCache.expiresAtMs > now) {
    return googleCertCache.certs;
  }
  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!res.ok) {
    throw new Error('Unable to fetch Firebase public verification certificates.');
  }
  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
  const ttlSec = maxAgeMatch ? Math.max(60, Number(maxAgeMatch[1])) : 3600;
  googleCertCache = {
    certs,
    expiresAtMs: now + ttlSec * 1000,
  };
  return certs;
}

export interface VerifiedAdminToken {
  uid: string;
  email: string;
}

export async function verifyFirebaseAdminIdToken(
  idToken: string,
  expectedProjectId: string,
  allowedAdminEmail: string
): Promise<VerifiedAdminToken> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed authentication token.');
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
    alg?: string;
    kid?: string;
  };
  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported token signature algorithm.');
  }

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    email?: string;
    email_verified?: boolean;
  };

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.aud !== expectedProjectId) {
    throw new Error('Invalid token audience.');
  }
  if (payload.iss !== `https://securetoken.google.com/${expectedProjectId}`) {
    throw new Error('Invalid token issuer.');
  }
  if (!payload.sub || typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('Authentication token expired.');
  }
  if (!payload.email_verified || !payload.email) {
    throw new Error('Verified email required.');
  }
  if (payload.email.toLowerCase() !== allowedAdminEmail.toLowerCase()) {
    throw new Error('Account is not authorized as admin.');
  }

  const certs = await fetchGoogleSecureTokenCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    throw new Error('Unknown signing certificate key ID.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const sigBuf = Buffer.from(signatureB64, 'base64url');
  if (!verifier.verify(certPem, sigBuf)) {
    throw new Error('Invalid authentication token signature.');
  }

  return { uid: payload.sub, email: payload.email };
}
