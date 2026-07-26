import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AdminJwtPayload, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { CreateMarketingTeamDto } from './dto/create-marketing-team.dto';
import { MarketingTeamsService } from './marketing-teams.service';

@Controller('admin/marketing/teams')
@UseGuards(JwtAuthGuard)
export class MarketingTeamsController {
  constructor(private readonly marketingTeamsService: MarketingTeamsService) {}

  @Get()
  list() {
    return this.marketingTeamsService.listTree().then((data) => ({
      success: true,
      data,
    }));
  }

  @Get('assignable-users')
  listAssignableUsers() {
    return this.marketingTeamsService.listAssignableUsers().then((data) => ({
      success: true,
      data,
    }));
  }

  @Post()
  create(
    @Body() dto: CreateMarketingTeamDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    return this.marketingTeamsService
      .createTeam(dto, request.user?.sub ?? 0)
      .then((data) => ({
        success: true,
        message: 'Marketing team created.',
        data,
      }));
  }

  @Post(':id/members')
  addMember(@Param('id', ParseIntPipe) id: number, @Body() dto: AddTeamMemberDto) {
    return this.marketingTeamsService.addMember(id, dto).then((data) => ({
      success: true,
      message: 'Team member added.',
      data,
    }));
  }
}
