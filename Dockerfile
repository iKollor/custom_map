# =====================
# Stage 1: base
# =====================
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare yarn@4.13.0 --activate

# =====================
# Stage 2: installer
# Installs all dependencies leveraging Docker layer cache
# =====================
FROM base AS installer
WORKDIR /app

# Copy manifests needed for dependency resolution
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install all dependencies (frozen for reproducibility)
RUN yarn install --immutable

# =====================
# Stage 3: builder
# Builds the Next.js app
# =====================
FROM base AS builder
WORKDIR /app

# Build-time public env vars (NEXT_PUBLIC_* are inlined into the client bundle)
ARG NEXT_PUBLIC_MAP_STYLE
ARG NEXT_PUBLIC_MAP_STYLE_DARK
ARG NEXT_PUBLIC_DEFAULT_CENTER_LAT
ARG NEXT_PUBLIC_DEFAULT_CENTER_LNG
ARG NEXT_PUBLIC_DEFAULT_ZOOM
ENV NEXT_PUBLIC_MAP_STYLE=${NEXT_PUBLIC_MAP_STYLE}
ENV NEXT_PUBLIC_MAP_STYLE_DARK=${NEXT_PUBLIC_MAP_STYLE_DARK}
ENV NEXT_PUBLIC_DEFAULT_CENTER_LAT=${NEXT_PUBLIC_DEFAULT_CENTER_LAT}
ENV NEXT_PUBLIC_DEFAULT_CENTER_LNG=${NEXT_PUBLIC_DEFAULT_CENTER_LNG}
ENV NEXT_PUBLIC_DEFAULT_ZOOM=${NEXT_PUBLIC_DEFAULT_ZOOM}

# Copy installed node_modules and workspace structure from installer
COPY --from=installer /app ./

# Copy all source code
COPY . .

# Generate Prisma client
RUN yarn workspace web exec prisma generate

# Build only the web app via Turborepo
ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn turbo build --filter=web

# =====================
# Stage 4: runner
# Minimal production image using Next.js standalone output
# =====================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (includes server.js + required node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Copy static assets and public folder
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

# server.js is at apps/web/server.js inside the standalone output
CMD ["node", "apps/web/server.js"]
