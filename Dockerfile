FROM node:22-bookworm-slim AS manifests
WORKDIR /srv/boardtestify
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY app/package.json app/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/i18n/package.json packages/i18n/package.json

FROM manifests AS build
RUN npm ci --ignore-scripts
COPY frontend frontend
COPY packages packages
RUN npm run build

FROM manifests AS dependencies
RUN npm ci --omit=dev --ignore-scripts --workspace=@boardtestify/api --workspace=@boardtestify/domain --include-workspace-root

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates poppler-utils util-linux \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /srv/boardtestify
ENV NODE_ENV=production PORT=4000 RUN_WORKER=false
COPY --from=dependencies /srv/boardtestify/node_modules ./node_modules
COPY --from=dependencies /srv/boardtestify/backend ./backend
COPY --from=dependencies /srv/boardtestify/packages ./packages
COPY backend/src backend/src
COPY packages/domain/src packages/domain/src
COPY --from=build /srv/boardtestify/frontend/dist frontend/dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:4000/api/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/src/server.js"]
