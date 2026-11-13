FROM node:24-alpine AS base

# ── Install dependencies ────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Build ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are baked into the JS bundle at build time.
# Non-secret values are hardcoded here. SENTRY_AUTH_TOKEN is optional
# (only needed for source map uploads — app works without it).
ARG NEXT_PUBLIC_API_URL=https://tbt-backend-464464507912.asia-south1.run.app
ARG NEXT_PUBLIC_APP_URL=https://app.tamilbusinesstribe.com
ARG NEXT_PUBLIC_APP_NAME="Tamil Business Tribe"
ARG NEXT_PUBLIC_SENTRY_DSN=""
ARG SENTRY_AUTH_TOKEN=""
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID=""

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ENV NEXT_PUBLIC_RAZORPAY_KEY_ID=$NEXT_PUBLIC_RAZORPAY_KEY_ID
ENV NEXT_TELEMETRY_DISABLED=1

# `gcloud run deploy --source` cannot pass --build-arg, and --set-build-env-vars
# only reaches buildpack builds, never this Dockerfile — so CI writes the
# per-environment NEXT_PUBLIC_* values to .ci-build-env (KEY='value' lines,
# public values only) and they override the defaults above for this build.
RUN if [ -f .ci-build-env ]; then set -a && . ./.ci-build-env && set +a; fi && npm run build

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# standalone output + static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
