# App — Android / React Native

React Native JavaScript/JSX with Expo. `app/` inside this folder contains Expo Router screens; `src/` contains API/session helpers and shared native UI components.

Install dependencies with `npm ci` from the repository root. Set `EXPO_PUBLIC_API_URL` to an API URL reachable from your device. From the repository root, run `npm run dev:app`; alternatively, run `npm run dev` inside this folder.

Run `npx expo export --platform android` here to verify the JavaScript bundle. `eas.json` defines preview APK and production Android App Bundle profiles. A signed release requires your Expo account or Android signing/build environment; see `../docs/DEPLOYMENT.md`.
