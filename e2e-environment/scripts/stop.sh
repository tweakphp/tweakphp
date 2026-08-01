#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo " Stopping E2E Environment"
echo "=========================================="

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if [ -d "$BASE_DIR/apps" ]; then
        echo "--> Granting full permissions on apps directory..."
        docker run --rm -v "$BASE_DIR:/work" alpine chmod -R 777 /work/apps 2>/dev/null || true
    fi

    echo "--> Stopping Docker Compose containers..."
    cd "$BASE_DIR"
    docker compose down -v --remove-orphans 2>/dev/null || docker-compose down -v --remove-orphans 2>/dev/null || true
fi

if command -v kubectl >/dev/null 2>&1; then
    echo "--> Cleaning up Kubernetes manifests..."
    kubectl delete -f "$BASE_DIR/k8s/laravel-pod.yaml" --ignore-not-found --timeout=15s 2>/dev/null || true
    kubectl delete ns tweakphp-test --ignore-not-found --timeout=15s 2>/dev/null || true
fi

# Clean up generated applications directory safely
if [ -d "$BASE_DIR/apps" ]; then
    echo "--> Deleting generated test applications in apps/..."
    rm -rf "$BASE_DIR/apps" 2>/dev/null || docker run --rm -v "$BASE_DIR:/work" alpine rm -rf /work/apps 2>/dev/null || true
fi

echo "=========================================="
echo " Environment stopped and apps cleaned."
echo "=========================================="
