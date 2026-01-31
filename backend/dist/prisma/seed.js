"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient({});
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
//# sourceMappingURL=seed.js.map