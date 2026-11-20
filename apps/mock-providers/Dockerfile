FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ ./packages/
COPY apps/mock-providers/package.json ./apps/mock-providers/
RUN pnpm install --frozen-lockfile

COPY apps/mock-providers/ ./apps/mock-providers/
RUN pnpm --filter @voice-ai/mock-providers build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV MOCK_PROVIDERS_PORT=5200

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/mock-providers/package.json ./apps/mock-providers/
COPY --from=builder /app/apps/mock-providers/dist ./apps/mock-providers/dist

EXPOSE 5200
CMD ["node", "apps/mock-providers/dist/index.js"]
