FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ ./packages/
COPY apps/tts-server/package.json ./apps/tts-server/
ENV ONNXRUNTIME_NODE_INSTALL_CUDA=skip
RUN pnpm install --frozen-lockfile

COPY apps/tts-server/ ./apps/tts-server/
RUN pnpm --filter @voice-ai/tts-server build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV TTS_MODE=mock
ENV TTS_PORT=5100

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/tts-server/package.json ./apps/tts-server/
COPY --from=builder /app/apps/tts-server/dist ./apps/tts-server/dist

EXPOSE 5100
CMD ["node", "apps/tts-server/dist/index.js"]
