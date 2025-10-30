import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  console.log('🌱 Starting teams seed...');

  // Create or get a test user
  let user = await prisma.user.findFirst({ where: { email: 'dev+teams@local.test' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'dev+teams@local.test',
        name: 'Dev Teams User',
        authenticationMethod: 'MAGIC_LINK',
        createdAt: now,
        updatedAt: now,
      },
    });
    console.log('✅ Created user:', user.id);
  } else {
    console.log('ℹ️  Using existing user:', user.id);
  }

  // Workspace
  let workspace = await prisma.workspace.findFirst({ where: { userId: user.id } });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: 'Dev Workspace',
        slug: `dev-workspace-${Date.now()}`,
        userId: user.id,
        createdAt: now,
        updatedAt: now,
      },
    });
    console.log('✅ Created workspace:', workspace.id);
  } else {
    console.log('ℹ️  Using existing workspace:', workspace.id);
  }

  // Team
  let team = await prisma.team.findFirst({ where: { slug: 'dev-engineering-team' } });
  if (!team) {
    team = await prisma.team.create({
      data: {
        name: 'Engineering Team',
        slug: 'dev-engineering-team',
        description: 'Development and engineering team',
        workspaceId: workspace.id,
      },
    });
    console.log('✅ Created team:', team.id);
  } else {
    console.log('ℹ️  Using existing team:', team.id);
  }

  // Team member
  const existingMember = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: team.id, userId: user.id } },
  });

  if (!existingMember) {
    const member = await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: user.id,
        role: 'OWNER',
      },
    });
    console.log('✅ Created team member:', member.id, '(role: OWNER)');
  } else {
    console.log('ℹ️  Team member already exists');
  }

  // Private space
  let privateSpace = await prisma.space.findFirst({
    where: {
      workspaceId: workspace.id,
      visibility: 'PRIVATE',
      workspace: { userId: user.id }
    },
  });

  if (!privateSpace) {
    privateSpace = await prisma.space.create({
      data: {
        name: 'My Private Space',
        visibility: 'PRIVATE',
        workspaceId: workspace.id,
      },
    });
    console.log('✅ Created private space:', privateSpace.id);
  } else {
    console.log('ℹ️  Using existing private space:', privateSpace.id);
  }

  // Team space 1 - Engineering
  let engineeringSpace = await prisma.space.findFirst({
    where: { teamId: team.id, name: 'Engineering Notes' }
  });

  if (!engineeringSpace) {
    engineeringSpace = await prisma.space.create({
      data: {
        name: 'Engineering Notes',
        description: 'Technical documentation and engineering team notes',
        visibility: 'TEAM',
        teamId: team.id,
        workspaceId: workspace.id,
      },
    });
    console.log('✅ Created team space (Engineering):', engineeringSpace.id);
  } else {
    console.log('ℹ️  Using existing engineering space:', engineeringSpace.id);
  }

  // Team space 2 - Design
  let designSpace = await prisma.space.findFirst({
    where: { teamId: team.id, name: 'Design & Frontend' }
  });

  if (!designSpace) {
    designSpace = await prisma.space.create({
      data: {
        name: 'Design & Frontend',
        description: 'UI/UX design docs and frontend architecture',
        visibility: 'TEAM',
        teamId: team.id,
        workspaceId: workspace.id,
      },
    });
    console.log('✅ Created team space (Design):', designSpace.id);
  } else {
    console.log('ℹ️  Using existing design space:', designSpace.id);
  }

  // Summary
  const stats = {
    teams: await prisma.team.count({ where: { workspaceId: workspace.id } }),
    spaces: await prisma.space.count({ where: { workspaceId: workspace.id } }),
    teamMembers: await prisma.teamMember.count({ where: { teamId: team.id } }),
  };

  console.log('\n📊 Seed Summary:');
  console.log('  - User ID:', user.id);
  console.log('  - User Email:', user.email);
  console.log('  - Workspace ID:', workspace.id);
  console.log('  - Team ID:', team.id);
  console.log('  - Teams:', stats.teams);
  console.log('  - Spaces:', stats.spaces);
  console.log('  - Team Members:', stats.teamMembers);
  console.log('\n💡 Next steps:');
  console.log('  1. Create episodes in Neo4j via conversation API');
  console.log('  2. Run reclassification job to assign episodes to spaces');
  console.log('\n✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
