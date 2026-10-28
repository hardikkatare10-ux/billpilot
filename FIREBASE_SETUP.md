# Firebase setup for Dukan Yantra and NearBasket

## What is already in this project

The project already includes Firebase SDK (`firebase` in `package.json`), initialization in
`src/lib/firebase.ts`, email/password Authentication and profile documents in
`src/app/firebaseAuth.tsx`, and a localStorage-to-Firestore sync layer in
`src/lib/cloudSync.ts`.

The current sync design stores each account's app data under:

- `users/{Firebase Auth UID}` — profile
- `users/{Firebase Auth UID}/kv/{key}` — synced app data
- `users/{Firebase Auth UID}/kv/{key}~1`, `~2`, etc. — chunks for large values

This is account backup/sync of app state. It is not yet a normalized, multi-shop cloud database;
it does not automatically make separate users share products or inventory. Each signed-in Firebase
UID has its own private sync area. Do not use this design alone for a shared marketplace.

## 1. Create a Firebase project and web app

1. Open https://console.firebase.google.com/ and create/select your project.
2. Add a Web app in Project settings > General > Your apps.
3. Copy the web app configuration values into a local `.env.local` file.
4. Enable Authentication > Sign-in method > Email/Password.
5. Create a Cloud Firestore database.
6. If you use Firebase Storage, enable it and confirm its billing/plan requirements in Firebase Console.

Copy `.env.example` to `.env.local`, then fill in the values. Do not commit `.env.local`.
The Vite `VITE_` values are included in the browser bundle; they are app configuration, not
private credentials. Never put service-account JSON/private keys in frontend code.

## 2. Deploy Firestore rules

Install Firebase CLI if needed, sign in, and select the correct project:

```bash
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only firestore:rules
```

If you have enabled Storage and want to use the provided Storage rules:

```bash
npx firebase-tools deploy --only storage
```

Review the project selected by `firebase-tools use --add` before deploying. The provided rules
allow each user to read/write only their own profile and `kv` sync documents. All other paths are
denied. They match the current app code; do not use open test-mode rules in production.

## 3. Run locally

```bash
npm install
npm run dev
```

To build-check:

```bash
npm run build
npm test
```

## 4. Configure production hosting

Add the same `VITE_FIREBASE_*` values in your hosting provider's environment-variable settings,
then rebuild/redeploy. For Vercel, add them under Project > Settings > Environment Variables.
Do not add quotes unless the value itself includes them.

## 5. First-run and sync checks

- Use the same Firebase project in local development and production.
- Confirm Email/Password authentication is enabled.
- Register a test account, add sample test data, refresh, and verify it remains.
- Sign in on a second browser/device with the same account and check that data hydrates.
- Check DevTools Console and Firebase Console > Firestore > Usage if sync fails.
- Do not test destructive reset/wipe actions with real business data.

## Important limitations and next step

The app currently uses localStorage as its business-data model and mirrors keys beginning with
`billpro_` to Firestore after a debounce. It is suitable for per-account backup/sync when all
updates go through the synced setters. Direct localStorage writes may not be synced unless they
also call `queuePush`.

For true multi-device collaboration among multiple staff under one shop, or for a customer-facing
marketplace that must read the shop's inventory, change the data model to shop-scoped Firestore
collections such as `shops/{shopId}/products/{productId}` and enforce owner/staff permissions with
trusted membership documents. Do not simply make user data public or relax the rules.
