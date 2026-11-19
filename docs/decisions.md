# Architectural Decisions & Version Log

This document records exact library versions, architectural trade-offs, plan adjustments, and external provider free-tier limits.

## Tool & Library Versions

| Component             | Version                           | Phase   | Notes                                                                         |
| --------------------- | --------------------------------- | ------- | ----------------------------------------------------------------------------- |
| Node.js               | `24.19.0`                         | Phase 0 | Meets `@livekit/agents` minimum (`>= 20.0.0`) and recommended `24+`           |
| pnpm                  | `11.21.0`                         | Phase 0 | Single package manager across monorepo                                        |
| Docker Compose        | `v5.4.0`                          | Phase 0 | Running via Docker Desktop + WSL 2 on Windows                                 |
| Turborepo (`turbo`)   | `2.11.11`                         | Phase 1 | Uses v2 `tasks` schema in `turbo.json`                                        |
| TypeScript            | `5.9.3`                           | Phase 1 | Strict mode across all workspaces                                             |
| ESLint                | `9.39.5`                          | Phase 1 | Flat config (`eslint.config.mjs`) via `@voice-ai/config`                      |
| Prettier              | `3.10.1`                          | Phase 1 | Shared preset via `@voice-ai/config/prettier`                                 |
| tsup                  | `8.5.1`                           | Phase 1 | Builds `@voice-ai/shared` to dual ESM + CJS                                   |
| Vitest                | `3.2.7`                           | Phase 1 | Unit test runner for `shared`, `agent`, `tts-server`, `mock-providers`, `web` |
| PostgreSQL + pgvector | `pgvector/pgvector:pg17`          | Phase 2 | Local dev DB (`5434`, volume `pgdata`) & test DB (`5433`, `tmpfs`)            |
| Redis                 | `redis:7-alpine`                  | Phase 2 | Local dev (`6379`) & test (`6380`) for BullMQ and concurrency slots           |
| LiveKit Server        | `livekit/livekit-server:v1.13.11` | Phase 2 | Pinned release; `rtc.node_ip: 127.0.0.1` for Docker Desktop on Windows        |
| NestJS                | `11.0.10`                         | Phase 3 | Core API framework with CommonJS build                                        |
| Prisma ORM            | `6.19.3`                          | Phase 3 | Database ORM with pgvector Unsupported column support                         |
| Terminus              | `11.0.0`                          | Phase 3 | Health checks for PostgreSQL and Redis on `/api/health`                       |
| Pino                  | `nestjs-pino 4.3.1`               | Phase 3 | Structured JSON logging with request IDs on every log line                    |

## External Free-Tier Limits

> Update these rows whenever provider limits are verified or change.

| Provider             | Service / Model                                       | Free-Tier Limits                                                                  | Last Checked | Notes                                                            |
| -------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------- |
| Groq                 | Whisper STT (`whisper-large-v3-turbo`)                | _Verify in console.groq.com_                                                      | Phase 0/1    | Free tier is rate-limited per minute and per hour of audio       |
| NVIDIA NIM           | LLM (`meta/llama-3.1-8b-instruct`)                    | ~40 requests/min per account (verify in `build.nvidia.com`)                       | Phase 0/1    | Verify model availability via `GET /v1/models` before Phase 10   |
| NVIDIA NIM           | Embeddings (`nvidia/nv-embedqa-e5-v5`)                | Shared NIM quota; `1024`-dim vectors; requires `input_type: "passage" \| "query"` | Phase 0/1    | Confirmed `EMBED_DIM=1024` against NVIDIA docs                   |
| Kokoro (`kokoro-js`) | Local CPU TTS (`onnx-community/Kokoro-82M-v1.0-ONNX`) | Unlimited (local CPU)                                                             | Phase 0/1    | 24 kHz mono audio; downloads ONNX weights on first run           |
| LiveKit Server       | Self-hosted WebRTC (Docker)                           | Unlimited (local)                                                                 | Phase 0/1    | Fallback: LiveKit Cloud free tier if Windows WebRTC issues occur |

## Key Decisions & Notes

1. **Dual ESM + CJS build for `@voice-ai/shared` (Phase 1):**
   NestJS (`apps/api`) compiles to CommonJS while LiveKit Agents (`apps/agent`) and Fastify services (`apps/tts-server`, `apps/mock-providers`) use ESM. Building `@voice-ai/shared` with `tsup` (`format: ['esm', 'cjs']`) and explicit conditional `exports` (`import` → `.js`, `require` → `.cjs`) avoids `ERR_REQUIRE_ESM` issues.
2. **Repository name (Phase 1):**
   The workspace and GitHub repository are named `voice-ai-agent` (`https://github.com/Rahul1907/voice-ai-agent.git`), with internal packages scoped under `@voice-ai/*`.
3. **pnpm 11 strict dependency builds (Phase 1):**
   pnpm 11 enables `strictDepBuilds: true` by default and replaced `onlyBuiltDependencies` with `allowBuilds` in `pnpm-workspace.yaml`. Explicitly allow-listing `esbuild: true` keeps installs secure and deterministic in local dev and CI.
4. **LiveKit keys via `LIVEKIT_KEYS` env var & separate test Compose project (Phase 2):**
   `infra/livekit.yaml` omits the `keys:` block so secrets are never committed; `infra/docker-compose.yml` passes `LIVEKIT_KEYS` from env with local dev defaults (`devkey`). `infra/docker-compose.test.yml` uses `name: voice-ai-test` so dev and test stacks have isolated Docker networks and zero orphan-container warnings.
5. **Prisma 6 pinned for CommonJS NestJS compatibility (Phase 3):**
   Prisma 6 (`^6.4.1`) was chosen over Prisma 7 because NestJS 11 compiles to CommonJS by default. Prisma 6 natively outputs CJS without requiring experimental ESM loader flags or manual `@prisma/adapter-pg` pool wiring, while fully supporting `Unsupported("vector(1024)")` and pgvector HNSW cosine indexes.
6. **Port 5434 for dev Postgres on Windows (Phase 3):**
   The host machine already had a background PostgreSQL service running on port 5432. Following Section 13 of the plan, Docker dev Postgres was mapped to host port 5434 (`5434:5432`) to avoid port collisions while leaving test Postgres on 5433.
7. **Unified NestJS bootstrap via `setupApp` (Phase 3):**
   Middleware (`helmet`, `cookie-parser`), prefix (`api`), validation (`ValidationPipe`), CORS (`WEB_ORIGIN` with credentials), and `AllExceptionsFilter` are registered in `src/setup-app.ts` so both `main.ts` and integration tests share identical security and error formatting behavior.
8. **Upcoming Doc-Alignment Items to Watch:**
   - **Next.js 16 (Phase 6):** Next.js 16 renamed `middleware.ts` to `proxy.ts`. We will match the installed Next.js version.
   - **LiveKit Agents Node.js (Phase 10):** Uses `ServerOptions` (renamed from `WorkerOptions`) with `cli.runApp`.
