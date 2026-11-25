# Security Specification — gurudev_designs

## 1. Data Invariants
1. **Customer PII & File Isolation**: Raw mobile numbers, design requirements, design text, reference photos, logos, payment screenshots, UTR numbers, and Razorpay IDs/signatures reside exclusively in `/orders/{orderDocId}` and are readable only by verified admins (`isAdmin()`). Unauthenticated or non-admin users can never `get` or `list` `/orders`.
2. **Sanitized Real-Time Tracking & Phone Index**:
   - `/order_tracking/{trackingKey}` stores strictly basic tracking info (`orderId`, `phoneKey`, `customerName`, `serviceName`, `servicePrice`, `discountAmount`, `finalAmount`, `paymentStatus`, `status`, `deliveryStatus`, `createdAt`, `updatedAt`) with `allow list: if false`.
   - `/phone_indexes/{phoneKey}` maps SHA-256(`gd-phone-v1:${mobileLast10}`) to an array of `trackingKeys` (append-only for customers, `allow list: if false`, zero PII). Lookups pass through rate-limited `POST /api/orders/lookup-phone` before attaching real-time Firestore `onSnapshot` listeners.
3. **Server-Verified Razorpay & Manual Payment Separation**:
   - Manual `Scan & Pay QR` and `UPI Payment` orders are strictly locked to `paymentStatus == 'PAYMENT VERIFICATION PENDING'` and `status in ['NEW ORDER', 'PAYMENT VERIFICATION PENDING']` on creation; only Admin can mark them verified.
   - `Razorpay` orders require server-side HMAC-SHA256 signature verification AND Razorpay Payments API `captured` confirmation (`/api/payments/razorpay/verify`) plus well-formed `razorpayOrderId`, `razorpayPaymentId`, and 64-char hex `razorpaySignature` before being recorded.
4. **Admin Role Enforcement**: Only Google-authenticated users with `email_verified == true` matching the bootstrapped admin email or present in `/admins/{uid}` can modify services, prices, gallery items, website settings, or advance/verify orders.
5. **Strict Schema & Size Bounds**: Every collection enforces `hasAll` + `hasOnly`, string bounds, numeric ranges, array size caps, and server timestamps (`request.time`).

## 2. Abuse & Tamper Cases (All Blocked)
1. **Unauthenticated Order List Scrape**: `getDocs(collection(db, 'orders'))` -> DENIED.
2. **Unauthenticated Tracking / Phone Index Enumeration**: `getDocs(collection(db, 'order_tracking'))` or `getDocs(collection(db, 'phone_indexes'))` -> DENIED (`allow list: if false`).
3. **Shadow Field Injection on Order Create**: Extra ghost field -> DENIED (`hasOnly`).
4. **Fake Payment Status on QR/UPI Order Create**: Creating `Scan & Pay QR` order with `paymentStatus: 'PAYMENT VERIFIED'` -> DENIED.
5. **Phone Index Overwrite / Wipe**: Non-admin attempting to remove existing `trackingKeys` in `/phone_indexes/{phoneKey}` -> DENIED (`hasAll(existing().trackingKeys)`).
6. **Client Timestamp Forgery**: `createdAt != request.time` -> DENIED.
7. **Unauthorized Price Manipulation**: Non-admin updating `/services/{id}` -> DENIED.
8. **Razorpay Secret Exposure**: `RAZORPAY_KEY_SECRET` never exists in `VITE_*` or client bundle; lives exclusively in server `process.env`.
