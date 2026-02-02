const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const rooms = await prisma.room.findMany({ include: { teams: true } });
  console.log('--- Current Rooms in DB ---');
  console.log(JSON.stringify(rooms, null, 2));
  await prisma.$disconnect();
}

check();
