# TweakPHP E2E Testing Environment

Dedicated, script-managed E2E testing environment for verifying **TweakPHP** connection types:
- 🐳 **Docker Connections**: Testing connections to local running containers (`tweakphp-docker-app`).
- ⛵ **Laravel Sail Connections**: Testing connections to containerized Laravel Sail apps (`tweakphp-sail-app`).
- 🔑 **SSH Connections**: Testing remote execution over SSH (`tweakphp-ssh-app` on port `2222`).
- ☸️ **Kubernetes (kubectl) Connections**: Testing connection execution inside pods running in a local cluster (`tweakphp-test` namespace).


> - This entire `e2e-environment/` directory is **excluded** from production Electron app builds (configured via `!e2e-environment/**` in `package.json` under `build.files`).
> - Generated test applications inside `e2e-environment/apps/` are ignored in `.gitignore`.

---

## 🏗️ Architecture & How It Works

1. **Pre-Built Dedicated Docker Image (`Dockerfile`)**:
   - Built on `php:8.3-cli` with `pdo_sqlite`, `zip`, `unzip`, `git`, `openssh-server`, and Composer pre-baked.
   - Eliminates runtime `apt-get` delays, `dpkg` lock conflicts, and `ZipDownloader` errors.

2. **In-Container Provisioning**:
   - `composer create-project` runs **INSIDE** the PHP 8.3 container via `docker exec`.
   - `vendor/composer/platform_check.php` is generated natively by PHP 8.3.33, ensuring 100% platform check compliance with zero host PHP version leakage.
   - All test apps (`docker-app`, `sail-app`, `ssh-app`) are automatically configured with **SQLite** (`database/database.sqlite`).

---

## 🚀 Quick Start Guide

### 1. Start the Environment
To build containers, provision Laravel projects inside, and launch all services:

```bash
chmod +x e2e-environment/scripts/*.sh
./e2e-environment/scripts/start.sh
```

---

### 2. Copy TweakPHP Connection Parameters

After running `./e2e-environment/scripts/start.sh`, copy these exact values into TweakPHP as displayed in the terminal after the script finishes running.

---

### 3. Stop & Clean Up
To stop all containers, delete Kubernetes manifests, and wipe generated project files:

```bash
./e2e-environment/scripts/stop.sh
```

*(Note: `stop.sh` uses a lightweight Docker container to reset permissions on `apps/` before deletion, preventing any root-owned file permission errors).*
