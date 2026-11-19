# Windows 10/11 Setup & Docker Guide

This guide covers setting up and running the local infrastructure for **Voice AI Agent Platform** on Windows using PowerShell and Docker Desktop.

## 1. Prerequisites

- **Git for Windows** with `git config --global core.autocrlf input`
- **Node.js** `>= 20.0.0` (Node 24+ recommended)
- **pnpm** `>= 10.15.0`
- **Microsoft Visual C++ Redistributable (x64)** (required by `onnxruntime-node` for Silero VAD & Kokoro TTS)
- **WSL 2** (`wsl --install` from an Administrator PowerShell, followed by a reboot)
- **Docker Desktop** with **Settings → General → Use the WSL 2 based engine** enabled

## 2. Starting & Stopping Local Infrastructure

Keep Docker Desktop running while developing. All commands are run from the repo root in PowerShell.

### Development stack (`infra/docker-compose.yml`)

| Service                    | Host Port(s)                                 | Purpose                                                                    |
| -------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- |
| PostgreSQL 17 + `pgvector` | `5432`                                       | Primary database + vector embeddings (persisted in Docker volume `pgdata`) |
| Redis 7                    | `6379`                                       | BullMQ queues & concurrency limits                                         |
| LiveKit Server             | `7880` (HTTP/WS), `7881` (TCP), `7882` (UDP) | Real-time WebRTC audio server                                              |

```powershell
# Start all dev services in the background
pnpm infra:up

# Check status and healthchecks
docker compose -f infra/docker-compose.yml ps

# Tail logs for a specific service (e.g. livekit, postgres, redis)
docker compose -f infra/docker-compose.yml logs -f livekit

# Stop services (preserves your database volume)
pnpm infra:down
```

> **Warning:** Never run `docker compose -f infra/docker-compose.yml down -v` unless you intentionally want to wipe your local database — the `-v` flag deletes the `pgdata` volume.

### Integration test stack (`infra/docker-compose.test.yml`)

Runs isolated, ephemeral PostgreSQL (`5433`, stored in RAM via `tmpfs`) and Redis (`6380`) containers so integration tests never touch your dev database:

```powershell
pnpm infra:test:up
docker compose -f infra/docker-compose.test.yml ps
pnpm infra:test:down
```

## 3. Verifying the Services

```powershell
# Verify pgvector extension is enabled in Postgres
docker compose -f infra/docker-compose.yml exec postgres psql -U voice -d voice_agent -c "select extname from pg_extension;"

# Verify Redis responds
docker compose -f infra/docker-compose.yml exec redis redis-cli ping

# Verify LiveKit HTTP endpoint
curl.exe http://localhost:7880
```

## 4. Docker Desktop Tips & Troubleshooting on Windows

- **PowerShell script execution policy**: If `pnpm` scripts are blocked, run:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
  ```
- **Port already in use (e.g., local PostgreSQL on `5432`)**:
  Find the process holding the port:
  ```powershell
  netstat -ano | findstr ":5432 :6379 :7880"
  ```
  Stop the conflicting Windows service (e.g. `services.msc` → PostgreSQL) or update the host port in `infra/docker-compose.yml` and `.env`.
- **LiveKit WebRTC connects but has no audio**:
  1. Confirm `rtc.node_ip: 127.0.0.1` and `rtc.use_external_ip: false` in `infra/livekit.yaml`.
  2. Confirm port `7882/udp` and `7881/tcp` are published in `infra/docker-compose.yml`.
  3. Allow Docker Desktop through Windows Defender Firewall for private networks.
  4. **Fallback**: If corporate firewalls or VPNs block local WebRTC, create a free LiveKit Cloud project and point `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` in `.env` to it.
- **Passing custom `.env` LiveKit keys to Docker Compose**:
  By default, `infra/docker-compose.yml` uses `devkey` and the placeholder secret from `.env.example`. When you create a root `.env` with a custom `LIVEKIT_API_SECRET`, run:
  ```powershell
  docker compose --env-file .env -f infra/docker-compose.yml up -d
  ```
- **Memory usage**: WSL 2 can claim significant RAM over time. You can cap it by creating `C:\Users\<YourUser>\.wslconfig`:
  ```ini
  [wsl2]
  memory=6GB
  ```
  Then restart WSL with `wsl --shutdown` and reopen Docker Desktop.
