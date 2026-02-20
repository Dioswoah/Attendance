# Build stage
FROM node:20-alpine AS builder

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Skip Puppeteer browser download (not needed for production)
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# VERIFY SOURCE FRESHNESS
RUN grep "Employment Location" src/app/\(user\)/user/page.tsx || (echo "Source code is stale!" && exit 1)

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app


# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose port
EXPOSE 8080

# Set environment variable for Next.js to listen on all interfaces
ENV HOSTNAME="0.0.0.0"
ENV PORT=8080

# Start the application
CMD ["npm", "start"]
