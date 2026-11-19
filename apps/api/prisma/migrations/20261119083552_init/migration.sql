-- CreateEnum
CREATE TYPE "AgentLanguage" AS ENUM ('en');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('CREATED', 'ACTIVE', 'ENDED', 'FAILED');

-- CreateEnum
CREATE TYPE "CallEndReason" AS ENUM ('USER_HANGUP', 'AGENT_ENDED', 'IDLE', 'TIMEOUT', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "SummaryStatus" AS ENUM ('PENDING', 'DONE', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TranscriptRole" AS ENUM ('USER', 'AGENT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "greeting" VARCHAR(300) NOT NULL DEFAULT 'Hi! How can I help you today?',
    "voice" TEXT NOT NULL DEFAULT 'af_heart',
    "language" "AgentLanguage" NOT NULL DEFAULT 'en',
    "llmModel" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "maxCallDurationSec" INTEGER NOT NULL DEFAULT 600,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "roomName" TEXT NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'CREATED',
    "endReason" "CallEndReason",
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "summary" TEXT,
    "summaryStatus" "SummaryStatus" NOT NULL DEFAULT 'PENDING',
    "avgLatencyMs" INTEGER,
    "p50LatencyMs" INTEGER,
    "p95LatencyMs" INTEGER,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_segments" (
    "id" UUID NOT NULL,
    "callId" UUID NOT NULL,
    "segmentId" TEXT NOT NULL,
    "role" "TranscriptRole" NOT NULL,
    "text" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "spokenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcript_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turn_metrics" (
    "id" UUID NOT NULL,
    "callId" UUID NOT NULL,
    "turnIndex" INTEGER NOT NULL,
    "eouDelayMs" INTEGER,
    "sttMs" INTEGER,
    "llmTtftMs" INTEGER,
    "ttsTtfbMs" INTEGER,
    "totalMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turn_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "filename" VARCHAR(100) NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "embedding" vector(1024),

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "agents_userId_deletedAt_idx" ON "agents"("userId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "calls_roomName_key" ON "calls"("roomName");

-- CreateIndex
CREATE INDEX "calls_userId_createdAt_idx" ON "calls"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "calls_status_idx" ON "calls"("status");

-- CreateIndex
CREATE INDEX "transcript_segments_callId_sequence_idx" ON "transcript_segments"("callId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_segments_callId_segmentId_key" ON "transcript_segments"("callId", "segmentId");

-- CreateIndex
CREATE INDEX "turn_metrics_callId_turnIndex_idx" ON "turn_metrics"("callId", "turnIndex");

-- CreateIndex
CREATE INDEX "knowledge_documents_agentId_idx" ON "knowledge_documents"("agentId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_agentId_idx" ON "knowledge_chunks"("agentId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_documentId_idx" ON "knowledge_chunks"("documentId");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turn_metrics" ADD CONSTRAINT "turn_metrics_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex on vector column for KnowledgeChunk (HNSW cosine similarity index)
CREATE INDEX IF NOT EXISTS "knowledge_chunks_embedding_idx" ON "knowledge_chunks" USING hnsw (embedding vector_cosine_ops);

