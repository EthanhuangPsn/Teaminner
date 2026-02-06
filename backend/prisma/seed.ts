import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({});

async function main() {
  // 检查是否已经存在房间，避免重复创建
  const existingRoom = await prisma.room.findFirst({
    where: { roomName: '攻坚团 01' }
  });

  if (existingRoom) {
    console.log('Default room already exists, skipping seed.');
    return;
  }

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

  console.log('Created default room:', room);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
