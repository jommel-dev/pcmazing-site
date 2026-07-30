import { Body, Controller, Delete, Get, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { ChangeUserPasswordDto } from '../users/dto/change-user-password.dto';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { StaffAccessDto } from './dto/staff-access.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AdminJwtPayload, JwtAuthGuard } from './guards/jwt-auth.guard';
import { StaffGateGuard } from './guards/staff-gate.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

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

  @Post('portal-login')
  async portalLogin(@Body() dto: AdminLoginDto) {
    const result = await this.authService.portalLogin(dto);

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

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Req() request: Request & { user: AdminJwtPayload },
    @Body() dto: UpdateProfileDto,
  ) {
    await this.usersService.update(request.user.sub, dto, request.user.sub);
    const profile = await this.authService.getProfile(request.user.sub, request.user.source);

    return {
      success: true,
      message: 'Profile updated.',
      data: profile,
    };
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() request: Request & { user: AdminJwtPayload },
    @Body() dto: ChangeUserPasswordDto,
  ) {
    await this.usersService.changePassword(request.user.sub, dto);
    const profile = await this.authService.getProfile(request.user.sub, request.user.source);

    return {
      success: true,
      message: 'Password updated.',
      data: profile,
    };
  }

  @Post('me/profile-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadProfileImage(
    @Req() request: Request & { user: AdminJwtPayload },
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.usersService.uploadProfileImage(request.user.sub, file);
    const profile = await this.authService.getProfile(request.user.sub, request.user.source);

    return {
      success: true,
      message: 'Profile image updated.',
      data: profile,
    };
  }

  @Delete('me/profile-image')
  @UseGuards(JwtAuthGuard)
  async removeProfileImage(@Req() request: Request & { user: AdminJwtPayload }) {
    await this.usersService.removeProfileImage(request.user.sub);
    const profile = await this.authService.getProfile(request.user.sub, request.user.source);

    return {
      success: true,
      message: 'Profile image removed.',
      data: profile,
    };
  }
}
