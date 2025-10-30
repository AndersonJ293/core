import { runQuery } from '../app/lib/neo4j.server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Creating test episodes in Neo4j...');

  // Find the seeded user and workspace
  const user = await prisma.user.findFirst({
    where: { email: 'dev+teams@local.test' },
  });

  if (!user) {
    console.error('❌ Test user not found. Run seed first: pnpm seed:teams');
    process.exit(1);
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
  });

  if (!workspace) {
    console.error('❌ Workspace not found for user');
    process.exit(1);
  }

  console.log('✅ Found user:', user.id);
  console.log('✅ Found workspace:', workspace.id);

  // Test episodes with varied content for classification
  const episodes = [
    {
      uuid: `episode-eng-${Date.now()}-1`,
      content: 'Implemented new API endpoint for user authentication. Updated JWT token handling and added refresh token logic. Engineering team should review the security implications.',
      originalContent: 'Implemented new API endpoint for user authentication. Updated JWT token handling and added refresh token logic.',
      source: 'manual',
      metadata: { type: 'technical' },
    },
    {
      uuid: `episode-eng-${Date.now()}-2`,
      content: 'Fixed critical bug in database connection pool. The issue was causing timeouts during high load. Engineering notes: consider implementing connection retry logic.',
      originalContent: 'Fixed critical bug in database connection pool.',
      source: 'manual',
      metadata: { type: 'bugfix' },
    },
    {
      uuid: `episode-design-${Date.now()}-1`,
      content: 'Updated the frontend color palette and design system. New components follow the latest UI guidelines. Design team approved the new button styles and spacing.',
      originalContent: 'Updated the frontend color palette and design system.',
      source: 'manual',
      metadata: { type: 'design' },
    },
    {
      uuid: `episode-design-${Date.now()}-2`,
      content: 'Created mockups for the new dashboard layout. Frontend components will need to be refactored to match the design. Figma file shared with design team.',
      originalContent: 'Created mockups for the new dashboard layout.',
      source: 'manual',
      metadata: { type: 'design' },
    },
    {
      uuid: `episode-personal-${Date.now()}-1`,
      content: 'Reminder: buy groceries after work. Call mom this weekend. Schedule dentist appointment for next month.',
      originalContent: 'Reminder: buy groceries after work.',
      source: 'manual',
      metadata: { type: 'personal' },
    },
    {
      uuid: `episode-personal-${Date.now()}-2`,
      content: 'Ideas for weekend vacation. Maybe visit the mountains or go to the beach. Need to check weather forecast.',
      originalContent: 'Ideas for weekend vacation.',
      source: 'manual',
      metadata: { type: 'personal' },
    },
    {
      uuid: `episode-mixed-${Date.now()}-1`,
      content: 'Meeting notes: discussed API architecture, frontend refactoring, and backend performance improvements with the engineering and design teams. Action items: update documentation.',
      originalContent: 'Meeting notes: discussed API architecture.',
      source: 'manual',
      metadata: { type: 'meeting' },
    },
  ];

  const now = new Date().toISOString();
  let created = 0;

  for (const episode of episodes) {
    try {
      // Create episode node in Neo4j
      const query = `
        CREATE (ep:Episode {
          uuid: $uuid,
          content: $content,
          originalContent: $originalContent,
          source: $source,
          metadata: $metadata,
          userId: $userId,
          createdAt: $createdAt,
          validAt: $validAt,
          spaceIds: []
        })
        RETURN ep.uuid as uuid
      `;

      await runQuery(query, {
        uuid: episode.uuid,
        content: episode.content,
        originalContent: episode.originalContent,
        source: episode.source,
        metadata: JSON.stringify(episode.metadata),
        userId: user.id,
        createdAt: now,
        validAt: now,
      });

      created++;
      console.log(`  ✅ Created episode: ${episode.uuid.substring(0, 30)}...`);
    } catch (error) {
      console.error(`  ❌ Failed to create episode ${episode.uuid}:`, error);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`  - Total episodes created: ${created}/${episodes.length}`);
  console.log(`  - User ID: ${user.id}`);
  console.log(`  - Workspace ID: ${workspace.id}`);

  console.log(`\n💡 Next steps:`);
  console.log(`  1. Run reclassification: pnpm reclassify dev+teams@local.test`);
  console.log(`  2. Verify episodes in Neo4j:`);
  console.log(`     MATCH (ep:Episode {userId: "${user.id}"}) RETURN ep LIMIT 10`);
  console.log(`\n✅ Test episodes created!`);
}

main()
  .catch((e) => {
    console.error('❌ Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
