# Deployment

Production runs two containers on the app server. Cloudflare Tunnel already routes traffic to them. Nothing is published on the host ports.

| Compose service | Container | Public hostname | Port inside the network |
| --- | --- | --- | --- |
| `pcmazing_frontend_app` | `pcmazing_frontend_app` | `https://www.pcmazing.com` | 80 |
| `pcmazing_backend_api` | `pcmazing_backend_api` | `https://v1-api.pcmazing.com` | 3000 |

Both containers join the external Docker network `app-tier`, which is the same network as the tunnel. PostgreSQL is reached on that network at host `db`.

The server checkout is `~/apps/pcmazing-site`. Run every command below from that directory, as root.

## One-time setup

1. Confirm the shared network exists:

   ```bash
   docker network ls | grep app-tier
   ```

   If the tunnel container is on a different network, set `DOCKER_NETWORK` in `.env.docker` to that name.

2. Create the env file and fill in the database password, JWT secret, and staff passcode:

   ```bash
   cp .env.docker.example .env.docker
   nano .env.docker
   ```

   `.env.docker` stays on the server. It is gitignored. `backend/.env` is for local development and is not read by these containers.

3. Confirm Postgres has a `pcmazing_site` database that the user in `DATABASE_URL` can use.

Uploaded files live in `backend/uploads` on the host and are bind-mounted into the API container. That directory survives image rebuilds. Do not delete it during a deploy.

## Deploy

Pull the commit, build the employee app in this checkout, then build each image and start from those images:

```bash
cd ~/apps/pcmazing-site
git pull

cd portal-app
chmod +x ./gradlew
./gradlew :androidApp:assembleRelease

cd ..
docker compose --env-file .env.docker build pcmazing_frontend_app
docker compose --env-file .env.docker build pcmazing_backend_api
docker compose --env-file .env.docker up -d --no-build
```

`gradlew.bat` is the Windows wrapper and will not run on the server. The release reads `API_URL` from this checkout's `.env.docker` and writes `backend/downloads/portal.apk`. The backend image copies that file in, so a new APK is served only after `pcmazing_backend_api` is rebuilt.

Build first, then start. `up -d --no-build` only recreates containers when the new images exist. If a build fails, the containers that are already running stay up.

`API_URL` and `PUBLIC_SITE_URL` from `.env.docker` are compiled into the frontend. `API_URL` is also compiled into the release APK. Changing `API_URL` requires a portal release and a frontend rebuild, not only a container restart.

A normal code deploy is the same commands after `git pull`. You do not need to recreate `.env.docker`.

## Check that it came up

```bash
docker compose --env-file .env.docker ps
docker logs --tail 80 pcmazing_backend_api
docker logs --tail 40 pcmazing_frontend_app
```

The API container should show a healthy status after the start period. From the server:

```bash
docker exec pcmazing_backend_api node -e "fetch('http://127.0.0.1:3000/health').then(r=>r.text()).then(console.log).catch(e=>{console.error(e); process.exit(1)})"
```

Then load `https://www.pcmazing.com` and confirm the site can reach `https://v1-api.pcmazing.com`.

## Employee app download

The public page is `https://www.pcmazing.com/app-downloads`. It asks for `APK_SERIAL_PORTAL` from `.env.docker` before it sends the file.

The deploy commands above are the release. Gradle prints the origin it baked in, for example `[env] GENERATED_RELEASE_API_BASE_URL=https://v1-api.pcmazing.com [/root/apps/pcmazing-site/.env.docker]`. Restart the API when the serial changes:

```bash
docker compose --env-file .env.docker restart pcmazing_backend_api
```

One-time SDK install, if `./gradlew` stops with `SDK location not found`:

```bash
apt-get update
apt-get install -y openjdk-17-jdk unzip wget
mkdir -p /opt/android-sdk/cmdline-tools
cd /tmp
wget -O cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip
unzip -q cmdtools.zip
rm -rf /opt/android-sdk/cmdline-tools/latest
mkdir -p /opt/android-sdk/cmdline-tools/latest
mv cmdline-tools/* /opt/android-sdk/cmdline-tools/latest/
printf 'sdk.dir=/opt/android-sdk\n' > ~/apps/pcmazing-site/portal-app/local.properties
export ANDROID_HOME=/opt/android-sdk
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-37" "build-tools;36.0.0"
```

Then run `./gradlew :androidApp:assembleRelease` again from `portal-app`.

## Logs and restart

```bash
docker logs -f pcmazing_backend_api
docker logs -f pcmazing_frontend_app

docker compose --env-file .env.docker restart pcmazing_backend_api
docker compose --env-file .env.docker restart pcmazing_frontend_app
```

Restart picks up changes in `.env.docker` for the API. It does not pick up frontend URL changes. Those are baked in at build time, so rebuild `pcmazing_frontend_app` and run `up -d --no-build` again.

Stop without deleting images or the uploads directory:

```bash
docker compose --env-file .env.docker stop
```

## npm segmentation fault (exit 139)

`node:22-slim` on this server is Node 22.23.3 on Debian. `npm ci` dies in under a second with `Segmentation fault (core dumped)` and exit 139. Turning off `io_uring` does not stop it. The Dockerfiles build on `node:22.23.3-alpine` instead, which does not use that Debian Node binary.

Pull that change before building. The log should show `node:22.23.3-alpine` and a line that prints `v22.23.3` before `npm ci`. If it still shows `node:22-slim` or `RUN npm ci --legacy-peer-deps || npm install`, the server is not on this commit.

If the Alpine build still exits 139, rebuild without cache:

```bash
docker compose --env-file .env.docker build --no-cache pcmazing_frontend_app
docker compose --env-file .env.docker build --no-cache pcmazing_backend_api
docker compose --env-file .env.docker up -d --no-build
```

## What each image does

**Frontend.** `frontend/Dockerfile` installs dependencies on Alpine Node, runs the production Angular build, and copies the browser files into nginx. The container listens on port 80. The public API host is written into the bundle from `API_URL`.

**Backend.** `backend/Dockerfile` compiles the NestJS app on Alpine Node, installs production dependencies (including `bcrypt`), and runs `node dist/main.js` as the `node` user on port 3000. Configuration comes from `.env.docker`.
