# App — Android / React Native

React Native JavaScript/JSX with Expo. `app/` inside this folder contains Expo Router screens; `src/` contains API/session helpers and shared native UI components.

Install dependencies with `npm ci` from the repository root. Set `EXPO_PUBLIC_API_URL` to an API URL reachable from your device. From the repository root, run `npm run dev:app`; alternatively, run `npm run dev` inside this folder.

Run `npx expo export --platform android` here to verify the JavaScript bundle. `eas.json` defines preview APK and production Android App Bundle profiles. A signed release requires your Expo account or Android signing/build environment; see `../docs/DEPLOYMENT.md`.

Students can select answer PDFs through the Android document picker when the API advertises PDF support. Maximum 10 MB/four attached pages including photos; server processing creates private JPEG pages. Forgot-password requests send the existing HTTPS email reset link; return to the app to sign in after resetting. Native checkout and administration remain on the website.

The Tests tab now opens subject/session series using the shared `/test-series` APIs. It supports subject search, category/mode/free/chapter filters, cursor pagination, paper-layout details and start/resume/result navigation. Returning from an exam or refreshing reloads attempt state. Changing profile class/stream remounts the library, and in-flight replies cannot populate another selected series. Study-pass checkout remains on the website. Bundle export and interaction-model tests do not replace physical-device/signing acceptance.
