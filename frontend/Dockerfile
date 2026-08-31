# Stage 1: Build Angular (Node 22)
FROM node:22-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

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
