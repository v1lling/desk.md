# desk.md hosted server image — builds the hosted SPA and runs the Hono server that
# serves it + the domain API + the OAuth AS + the MCP front door.
#
# IMPORTANT: build this ON the target machine, or with
# `docker buildx --platform` for the right CPU architecture — better-sqlite3 ships a native binary
# that must match the runtime architecture.

FROM node:22-bookworm AS build
WORKDIR /app
# Install deps against the workspace manifests first (better layer caching).
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/app/package.json packages/app/package.json
COPY packages/server/package.json packages/server/package.json
RUN npm ci
# Build the hosted SPA (VITE_DESK_HOSTED=1 → RemoteDeskService) into packages/app/dist,
# which the server serves as static files.
COPY . .
RUN npm run build:hosted -w @desk/app

FROM node:22-bookworm-slim AS run
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
# The server resolves the SPA dist relative to its own cwd, so run from its package dir.
WORKDIR /app/packages/server
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "start"]
