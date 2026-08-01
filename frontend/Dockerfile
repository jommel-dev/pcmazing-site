# Stage 1: Build Angular on Node 22
FROM node:22-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Use install if ci fails on older lockfiles; prefer ci when lock is in sync
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

COPY . .

ENV NG_BUILD_MAX_WORKERS=1
ENV UV_THREADPOOL_SIZE=1
ENV NODE_OPTIONS=--max-old-space-size=4096

# Pass configuration to ng via `--` so npm does not swallow it.
# Works whether or not package.json defines build:prod.
RUN npm run build -- --configuration=production

# Stage 2: Serve with Nginx
FROM nginx:alpine

COPY --from=builder /app/dist/pcmazing-site/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
