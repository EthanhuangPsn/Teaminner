import { Injectable, Logger } from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RoomsService } from '../rooms/rooms.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private prisma: PrismaService,
    private roomsService: RoomsService,
  ) {}

  // Every day at 3 AM
  // @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCleanup() {
    this.logger.log('Starting daily cleanup of expired guests and IP records...');

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. Find expired guest users (accountType='guest' and lastActiveAt < oneDayAgo)
    const expiredGuests = await this.prisma.user.findMany({
      where: {
        accountType: 'guest',
        lastActiveAt: { lt: oneDayAgo },
      },
    });

    this.logger.log(`Found ${expiredGuests.length} expired guest users.`);

    for (const guest of expiredGuests) {
      try {
        // Cascade delete: force leave room (this will handle leadership transfer)
        if (guest.roomId) {
          await this.roomsService.leaveRoom(guest.id);
        }
        // Delete the user
        await this.prisma.user.delete({ where: { id: guest.id } });
      } catch (error) {
        this.logger.error(`Failed to clean up guest ${guest.id}: ${error.message}`);
      }
    }

    // 2. Clean up expired IP bindings (lastActiveAt < oneDayAgo)
    const deletedBindings = await this.prisma.ipBinding.deleteMany({
      where: {
        lastActiveAt: { lt: oneDayAgo },
      },
    });

    this.logger.log(`Deleted ${deletedBindings.count} expired IP binding records.`);
    this.logger.log('Daily cleanup completed.');
  }
}
