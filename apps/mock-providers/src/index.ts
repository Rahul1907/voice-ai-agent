import dotenv from 'dotenv';
import { createMockProvidersServer } from './server.js';

dotenv.config();

const port = Number(process.env.MOCK_PROVIDERS_PORT || process.env.PORT) || 5200;
const host = process.env.MOCK_PROVIDERS_HOST || '0.0.0.0';

async function main() {
  const server = await createMockProvidersServer();

  try {
    await server.listen({ port, host });
    console.log(`[mock-providers] Running at http://${host}:${port}`);
  } catch (err) {
    console.error('[mock-providers] Failed to start:', err);
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    console.log(`[mock-providers] Received ${signal}, closing server...`);
    try {
      await server.close();
      process.exit(0);
    } catch (err) {
      console.error('[mock-providers] Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[mock-providers] Unhandled bootstrap error:', err);
  process.exit(1);
});
