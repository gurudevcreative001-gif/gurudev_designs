# gurudev_designs — Setup & Firebase Deployment Guide

## 1. Local Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server on port 3000:
   ```bash
   npm run dev
   ```
3. Run unit & security rule invariant tests:
   ```bash
   npx --yes tsx --test src/utils/orderUtils.test.ts firestore.rules.test.ts
   ```
4. Lint Firestore security rules:
   ```bash
   npx eslint firestore.rules
   ```

## 2. Firebase Configuration
- `firebase-applet-config.json` contains your provisioned Firebase Web App, Firestore Database ID, and Storage Bucket.
- **Firebase Authentication**: Ensure Google Sign-In provider is enabled in the Firebase Console (`Authentication -> Sign-in method -> Google`).
- **Admin Authorization**: The bootstrapped admin email (`rakeshpatel144589@gmail.com`) is authorized in `firestore.rules`. Additional admins can be added as documents under `/admins/{uid}`.

## 3. Deploy Rules & Hosting to Firebase
1. Log in to Firebase CLI:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```
2. Deploy Firestore Rules, Storage Rules, and Hosting:
   ```bash
   npm run build
   firebase deploy --only firestore:rules,storage,hosting
   ```
3. Verify CORS on Firebase Storage if customers upload large photos from your custom domain (`gsutil cors set cors.json gs://<your-bucket>`).
