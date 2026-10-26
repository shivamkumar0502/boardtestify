# Backend — Node.js API

Express JavaScript and MongoDB/Mongoose. REST routes, authentication, content management, persisted examinations, evaluations and optional integrations are in `src/`.

Install dependencies with `npm ci` from the repository root. Copy the root `.env.example` to the root `.env` and configure MongoDB and the JWT secret. From the root, run `npm run dev:backend`; alternatively, run `npm run dev` inside this folder.

Production start: `npm start` inside this folder. Build the frontend first; the API serves `../frontend/dist` on the same origin. API details and provider configuration are documented in the root `docs/` directory.
