import 'dotenv/config';
import { buildServer } from './server.js';
import { TTSEngine } from './tts-engine.js';

const PORT = Number(process.env.TTS_PORT) || 5100;
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  const ttsEngine = new TTSEngine();
  const server = buildServer({ ttsEngine, logger: true });

  try {
    // Start HTTP server immediately so /health can report status: loading
    await server.listen({ port: PORT, host: HOST });
    console.log(`[TTS Server] Listening on http://${HOST}:${PORT}`);

    // Initialize Kokoro TTS model in background
    console.log(`[TTS Server] Initializing TTS engine (mode: ${ttsEngine.currentMode})...`);
    await ttsEngine.init();
    console.log(`[TTS Server] Engine initialized and ready!`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  const signals = ['SIGINT', 'SIGTERM'];
  for (const sig of signals) {
    process.on(sig, async () => {
      console.log(`[TTS Server] Received ${sig}, closing gracefully...`);
      await server.close();
      process.exit(0);
    });
  }
}

start();
