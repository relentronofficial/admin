# ── Stage 1: Builder ──────────────────────────────────────────────────────
# Full toolchain needed to compile bcrypt native bindings and TypeScript.
FROM node:22-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && rm -rf /var/lib/apt/lists/*

# npm 10.9.x ships with node:22-slim and crashes with "edgesOut" on this package
# tree (affects all npm@10 including 10.9.2 and 10.9.9). npm@12 is the current
# stable release and resolves this regression.
RUN npm install -g npm@12

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
#
# Must use Bullseye (Debian 11) rather than the default Bookworm (node:22-slim)
# because Prisma's OpenSSL detection reports debian-openssl-1.1.x at runtime,
# which requires libssl.so.1.1. Bookworm ships libssl.so.3 only; Bullseye
# ships libssl.so.1.1 natively. Without this, the Prisma query engine binary
# fails to load with "libssl.so.1.1: cannot open shared object file".
FROM node:22-bullseye-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Ensure openssl is present for the Prisma 1.1.x query engine binary.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Copy only the pruned dependency tree and compiled output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# Prisma schema is read by the client at startup
COPY --from=builder /app/prisma ./prisma

EXPOSE 8000
CMD ["node", "dist/server.js"]
