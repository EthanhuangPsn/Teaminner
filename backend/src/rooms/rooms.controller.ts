import { Controller, Get, Post, Body, Param, UseGuards, Patch } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createRoomDto: CreateRoomDto) {
    return this.roomsService.create(createRoomDto);
  }

  @Get()
  findAll() {
    return this.roomsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  joinRoom(@Param('id') id: string, @GetUser() user: any) {
    return this.roomsService.joinRoom(id, user.userId);
  }

  @Post('leave')
  @UseGuards(JwtAuthGuard)
  leaveRoom(@GetUser() user: any) {
    return this.roomsService.leaveRoom(user.userId);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  toggleStatus(@Param('id') id: string, @Body('status') status: 'preparing' | 'assaulting') {
    return this.roomsService.toggleStatus(id, status);
  }

  @Post(':id/transfer-leader')
  @UseGuards(JwtAuthGuard)
  transferLeader(@Param('id') id: string, @Body('targetUserId') targetUserId: string) {
      return this.roomsService.transferLeader(id, targetUserId);
  }
}
