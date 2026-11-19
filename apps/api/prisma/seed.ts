import 'dotenv/config';
import { PrismaClient, AgentLanguage } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding development database...');

  const passwordHash = await argon2.hash('Demo@1234');

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      passwordHash,
    },
  });

  console.log(`Demo user created or found: ${demoUser.email} (${demoUser.id})`);

  const existingAgent = await prisma.agent.findFirst({
    where: { userId: demoUser.id, deletedAt: null },
  });

  if (!existingAgent) {
    const demoAgent = await prisma.agent.create({
      data: {
        userId: demoUser.id,
        name: 'Demo Support Assistant',
        systemPrompt:
          'You are a friendly and helpful customer support assistant. Answer questions clearly and concisely in one or two short sentences.',
        greeting: 'Hi! How can I help you today?',
        voice: 'af_heart',
        language: AgentLanguage.en,
        llmModel: 'meta/llama-3.1-8b-instruct',
        temperature: 0.6,
        maxCallDurationSec: 600,
      },
    });
    console.log(`Demo agent created: ${demoAgent.name} (${demoAgent.id})`);
  } else {
    console.log(`Demo agent already exists: ${existingAgent.name} (${existingAgent.id})`);
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
