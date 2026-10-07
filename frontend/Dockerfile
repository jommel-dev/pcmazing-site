# Stage 1: Build Angular
# node:22-slim (Debian, Node 22.23.3) segfaults inside npm on the production
# host (exit 139) even with io_uring disabled. Alpine uses musl and does not
# hit that crash. UV_USE_IO_URING=0 stays on, because libuv can still fault
# if io_uring is left enabled.
FROM node:22.23.3-alpine AS builder

ENV UV_USE_IO_URING=0

WORKDIR /app

RUN apk add --no-cache python3 make g++ linux-headers

COPY package*.json ./
RUN UV_USE_IO_URING=0 node -p process.version \
  && UV_USE_IO_URING=0 npm ci --legacy-peer-deps

COPY . .

# Baked into env.generated.ts at build time (browser calls public API host)
ARG API_URL=https://v1-api.pcmazing.com
ARG PUBLIC_SITE_URL=https://www.pcmazing.com
ARG BUILD_ID=
ENV API_URL=$API_URL \
    PUBLIC_SITE_URL=$PUBLIC_SITE_URL \
    BUILD_ID=$BUILD_ID \
    NG_BUILD_MAX_WORKERS=1 \
    UV_THREADPOOL_SIZE=1 \
    NODE_OPTIONS=--max-old-space-size=4096

RUN npm run build -- --configuration=production

# Stage 2: Nginx on port 80 (Cloudflare tunnel → pcmazing_frontend_app:80)
FROM nginx:alpine

COPY --from=builder /app/dist/pcmazing-site/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
