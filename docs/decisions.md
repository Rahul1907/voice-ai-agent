# Architectural Decisions & Version Log

This document records exact library versions, architectural trade-offs, plan adjustments, and external provider free-tier limits.

## Tool & Library Versions

| Component           | Version   | Phase   | Notes                                                                         |
| ------------------- | --------- | ------- | ----------------------------------------------------------------------------- |
| Node.js             | `24.19.0` | Phase 0 | Meets `@livekit/agents` minimum (`>= 20.0.0`) and recommended `24+`           |
| pnpm                | `11.21.0` | Phase 0 | Single package manager across monorepo                                        |
| Docker Compose      | `v5.4.0`  | Phase 0 | Running via Docker Desktop + WSL 2 on Windows                                 |
| Turborepo (`turbo`) | `2.11.11` | Phase 1 | Uses v2 `tasks` schema in `turbo.json`                                        |
| TypeScript          | `5.9.3`   | Phase 1 | Strict mode across all workspaces                                             |
| ESLint              | `9.39.5`  | Phase 1 | Flat config (`eslint.config.mjs`) via `@voice-ai/config`                      |
| Prettier            | `3.10.1`  | Phase 1 | Shared preset via `@voice-ai/config/prettier`                                 |
| tsup                | `8.5.1`   | Phase 1 | Builds `@voice-ai/shared` to dual ESM + CJS                                   |
| Vitest              | `3.2.7`   | Phase 1 | Unit test runner for `shared`, `agent`, `tts-server`, `mock-providers`, `web` |

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
4. **Upcoming Doc-Alignment Items to Watch:**
   - **Prisma 7 + NestJS (Phase 3):** Prisma 7 defaults to ESM-first `prisma-client` with explicit driver adapters (`@prisma/adapter-pg`) and `prisma.config.ts`. We will either configure `moduleFormat = "cjs"` with `@prisma/adapter-pg` or pin Prisma 6 if needed.
   - **Next.js 16 (Phase 6):** Next.js 16 renamed `middleware.ts` to `proxy.ts`. We will match the installed Next.js version.
   - **LiveKit Agents Node.js (Phase 10):** Uses `ServerOptions` (renamed from `WorkerOptions`) with `cli.runApp`.
