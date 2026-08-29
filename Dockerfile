# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Disable Next.js telemetry (no build-time egress)
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install OpenSSL for Prisma runtime
RUN apk add --no-cache openssl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# `.next/standalone` only ships the trimmed node_modules subset Next.js's
# server actually imports at runtime, which excludes the `prisma` CLI and
# `tsx` (devDependencies, never imported by app code). The documented
# `docker compose exec app npx prisma db push` / `npm run db:seed` init
# steps need both, so copy the full node_modules + root package.json from
# the builder (which ran a full `npm ci`) over the trimmed ones. This
# grows the image but keeps `db push`/`db:seed` runnable inside the
# container without any network access at runtime (engines were already
# fetched during `npm ci` in the builder stage).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy the entrypoint (syncs schema via `prisma db push`, then starts server)
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3456

ENV PORT=3456
ENV HOSTNAME="0.0.0.0"

CMD ["./docker-entrypoint.sh"]
