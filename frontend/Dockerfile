# OpenDrive Frontend Container
# Next.js with runtime API URL injection

FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build WITHOUT NEXT_PUBLIC_API_URL - it will be injected at runtime
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Install dos2unix for line ending fixes
RUN apk add --no-cache dos2unix

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy startup script
COPY docker-start.sh /app/docker-start.sh
RUN dos2unix /app/docker-start.sh && chmod +x /app/docker-start.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD wget -q --spider http://localhost:3000 || exit 1

CMD ["/app/docker-start.sh"]
