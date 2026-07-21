import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { StaffAccessDto } from './dto/staff-access.dto';
import { AdminJwtPayload, JwtAuthGuard } from './guards/jwt-auth.guard';
import { StaffGateGuard } from './guards/staff-gate.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('staff-access')
  verifyStaffAccess(@Body() dto: StaffAccessDto) {
    const result = this.authService.verifyStaffPasscode(dto.passcode);

    return {
      success: true,
      message: 'Staff access granted.',
      data: result,
    };
  }

  @Post('login')
  @UseGuards(StaffGateGuard)
  async login(@Body() dto: AdminLoginDto) {
    const result = await this.authService.login(dto);

    return {
      success: true,
      message: 'Login successful.',
      data: result,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() request: Request & { user: AdminJwtPayload }) {
    const profile = await this.authService.getProfile(request.user.sub, request.user.source);

    return {
      success: true,
      data: profile,
    };
  }
}
