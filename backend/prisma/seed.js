const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  __internal: {
    engine: {
      type: 'library'
    }
  }
});

async function main() {
  const room = await prisma.room.create({
    data: {
      roomName: '攻坚团 01',
      maxUsers: 20,
      teams: {
        create: [
          { teamColor: 'red' },
          { teamColor: 'yellow' },
          { teamColor: 'green' },
        ],
      },
    },
  });

  console.log({ room });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
