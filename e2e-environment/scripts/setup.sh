#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APPS_DIR="$BASE_DIR/apps"

mkdir -p "$APPS_DIR/docker-app" "$APPS_DIR/sail-app" "$APPS_DIR/ssh-app"

echo "=========================================="
echo " 1. Building and Starting Docker Containers..."
echo "=========================================="
cd "$BASE_DIR"
docker compose up -d --build

setup_in_container() {
    local CONTAINER=$1
    local IS_SAIL=$2

    echo "=========================================="
    echo " Creating Laravel INSIDE container: $CONTAINER"
    echo "=========================================="

    docker exec -w /var/www/html "$CONTAINER" bash -c "
        set -e
        if [ ! -f artisan ]; then
            echo '--> Creating fresh Laravel project...'
            rm -rf /tmp/laravel-tmp
            composer create-project laravel/laravel /tmp/laravel-tmp --prefer-dist --no-interaction
            cp -a /tmp/laravel-tmp/. /var/www/html/
            rm -rf /tmp/laravel-tmp
        else
            echo '--> Laravel already present.'
        fi

        echo '--> Configuring SQLite database...'
        mkdir -p database
        touch database/database.sqlite

        if [ -f .env ]; then
            sed -i 's/^DB_CONNECTION=.*/DB_CONNECTION=sqlite/' .env || echo 'DB_CONNECTION=sqlite' >> .env
            sed -i 's/^DB_HOST=/#DB_HOST=/' .env || true
            sed -i 's/^DB_PORT=/#DB_PORT=/' .env || true
            sed -i 's/^DB_DATABASE=/#DB_DATABASE=/' .env || true
            sed -i 's/^DB_USERNAME=/#DB_USERNAME=/' .env || true
            sed -i 's/^DB_PASSWORD=/#DB_PASSWORD=/' .env || true
        fi

        php artisan key:generate --ansi || true
        php artisan migrate --graceful --ansi || true
    "

    if [ "$IS_SAIL" = "true" ]; then
        docker exec -w /var/www/html "$CONTAINER" bash -c "
            echo '--> Installing Laravel Sail...'
            composer require laravel/sail --dev --no-interaction || true
            php artisan sail:install --with=none --no-interaction || true
        "
    fi

    # Fix file permissions for host user access
    docker exec -w /var/www/html "$CONTAINER" chmod -R 777 /var/www/html || true

    # Start artisan serve in background inside container
    docker exec -d -w /var/www/html "$CONTAINER" bash -c "nohup php artisan serve --host=0.0.0.0 --port=8000 > /dev/null 2>&1 &" || true

    echo "--> $CONTAINER ready and populated!"
    echo ""
}

setup_in_container "tweakphp-docker-app" "false"
setup_in_container "tweakphp-sail-app" "true"
setup_in_container "tweakphp-ssh-app" "false"

echo "=========================================="
echo " All container setups completed!"
echo "=========================================="
