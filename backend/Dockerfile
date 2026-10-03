# node:22-slim (Debian, Node 22.23.3) segfaults inside npm on the production
# host (exit 139) even with io_uring disabled. Alpine uses musl and does not
# hit that crash. UV_USE_IO_URING=0 is set in every stage that runs Node.
# ENV does not carry across stages, so it is repeated below.

# Stage 1: build NestJS
FROM node:22.23.3-alpine AS builder

ENV UV_USE_IO_URING=0

WORKDIR /app

RUN apk add --no-cache python3 make g++ linux-headers

COPY package*.json ./
RUN UV_USE_IO_URING=0 node -p process.version \
  && UV_USE_IO_URING=0 npm ci

COPY . .
RUN npm run build

# Stage 2: production deps (native modules like bcrypt)
FROM node:22.23.3-alpine AS deps

ENV UV_USE_IO_URING=0

WORKDIR /app

RUN apk add --no-cache python3 make g++ linux-headers

COPY package*.json ./
RUN UV_USE_IO_URING=0 node -p process.version \
  && UV_USE_IO_URING=0 npm ci --omit=dev \
  && npm cache clean --force

# Stage 3: runtime
FROM node:22.23.3-alpine AS runner

WORKDIR /app

ENV UV_USE_IO_URING=0
ENV NODE_ENV=production
ENV PORT=3000

RUN mkdir -p /app/uploads \
  && chown -R node:node /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

USER node

EXPOSE 3000

# Cloudflare tunnel → pcmazing_backend_api:3000
CMD ["node", "dist/main.js"]
