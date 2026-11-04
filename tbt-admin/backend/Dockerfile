# ── Stage 1: Builder ──────────────────────────────────────────────────────
# Full toolchain needed to compile bcrypt native bindings and TypeScript.
FROM node:22-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && rm -rf /var/lib/apt/lists/*

# npm 10.9.x ships with node:22-slim and has a known crash on certain package
# trees. Upgrade to 10.9.2 (last stable before the edgesOut regression) first.
RUN npm install -g npm@10.9.2

# Layer-cache package manifests separately from source
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Strip dev deps (TypeScript, tsx, vitest, @types, prisma CLI) from node_modules.
# Native binaries (bcrypt, @prisma/client engine, sharp) are production deps
# and survive this prune intact.
RUN npm prune --omit=dev

# ── Stage 2: Runner ───────────────────────────────────────────────────────
# Slim runtime image — no build tools, no source, no dev deps.
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only the pruned dependency tree and compiled output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# Prisma schema is read by the client at startup
COPY --from=builder /app/prisma ./prisma

EXPOSE 8000
CMD ["node", "dist/server.js"]
