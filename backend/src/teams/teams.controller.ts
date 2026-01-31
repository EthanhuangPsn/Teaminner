import { Controller, Post, Param, UseGuards, Delete, Body, Patch } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  joinTeam(@Param('id') id: string, @GetUser() user: any) {
    return this.teamsService.joinTeam(id, user.userId);
  }

  @Delete('leave')
  @UseGuards(JwtAuthGuard)
  leaveTeam(@GetUser() user: any) {
    return this.teamsService.leaveTeam(user.userId);
  }

  @Post(':id/captain')
  @UseGuards(JwtAuthGuard)
  setCaptain(@Param('id') id: string, @Body('userId') userId: string) {
    return this.teamsService.setCaptain(id, userId);
  }

  @Patch(':id/enable')
  @UseGuards(JwtAuthGuard)
  enableTeam(@Param('id') id: string, @Body('enabled') enabled: boolean) {
      return this.teamsService.enableTeam(id, enabled);
  }
}
