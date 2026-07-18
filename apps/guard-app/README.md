# Manglam Balaji Guard App

Expo SDK 56 guard client for registered society devices. It uses the real `/api/v1` backend,
rotating SecureStore credentials, SQLCipher-backed directory snapshots, and a durable offline
mutation queue. There are no demo credentials or local data generators.

## Local setup

1. Create `.env.local` from `.env.example` and point `EXPO_PUBLIC_API_URL` at a running API.
2. Install workspace dependencies from the repository root.
3. Build a development client with `eas build --profile development --platform android` or
   `pnpm --filter @manglam/guard-app exec expo run:android`.
4. Start Metro with `pnpm --filter @manglam/guard-app dev`.

SQLCipher and remote push notifications require a development/release build; Expo Go is not a
supported runtime for production-equivalent validation.

## Required backend routes

The app consumes guard authentication/device/gate, scoped directory, visitor, daily-help, parcel,
emergency, activity, files, push-endpoint, and offline-sync routes under `/api/v1`. Critical
mutations carry both `Idempotency-Key` and a stable client mutation UUID.
