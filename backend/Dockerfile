# Node 22 turns on libuv io_uring. On the production host that segfaults
# inside npm (exit 139). Set UV_USE_IO_URING=0 in every stage that runs Node.
# ENV does not carry across stages, so it is repeated below.

# Stage 1: build NestJS
FROM node:22-slim AS builder

ENV UV_USE_IO_URING=0

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: production deps (native modules like bcrypt)
FROM node:22-slim AS deps

ENV UV_USE_IO_URING=0

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Stage 3: runtime
FROM node:22-slim AS runner

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
