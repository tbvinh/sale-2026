#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

APP_IMAGE="${APP_IMAGE:-sale-app:latest}"
POSTGRES_IMAGE="postgres:16-alpine"
NGINX_IMAGE="${NGINX_IMAGE:-nginx:1.27-alpine}"
PACKAGE_NAME="${PACKAGE_NAME:-deployment-package.tar.gz}"
STAGE_DIR="$SCRIPT_DIR/.deployment-package"

command -v docker >/dev/null 2>&1 || { echo "Docker is not installed." >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker daemon is not running." >&2; exit 1; }

echo "Building ${APP_IMAGE}..."
docker build -t "$APP_IMAGE" -f "$SCRIPT_DIR/Dockerfile" "$SCRIPT_DIR"

echo "Pulling ${POSTGRES_IMAGE} and ${NGINX_IMAGE}..."
docker pull "$POSTGRES_IMAGE"
docker pull "$NGINX_IMAGE"

rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/images"

cp "$SCRIPT_DIR/docker-compose.yml" "$SCRIPT_DIR/install.sh" "$SCRIPT_DIR/start.sh" "$SCRIPT_DIR/install.bat" "$SCRIPT_DIR/start.bat" "$STAGE_DIR/"
cp -r "$SCRIPT_DIR/nginx" "$STAGE_DIR/"
chmod +x "$STAGE_DIR/install.sh" "$STAGE_DIR/start.sh"

sed "s|^APP_IMAGE=.*|APP_IMAGE=${APP_IMAGE}|" "$SCRIPT_DIR/.env.example" > "$STAGE_DIR/.env.example"

echo "Saving Docker images..."
docker save "$APP_IMAGE" | gzip -9 > "$STAGE_DIR/images/app-image.tar.gz"
docker save "$POSTGRES_IMAGE" | gzip -9 > "$STAGE_DIR/images/postgres-image.tar.gz"
docker save "$NGINX_IMAGE" | gzip -9 > "$STAGE_DIR/images/nginx-image.tar.gz"

tar -czf "$SCRIPT_DIR/$PACKAGE_NAME" -C "$STAGE_DIR" .
rm -rf "$STAGE_DIR"

echo "Created $SCRIPT_DIR/$PACKAGE_NAME"
