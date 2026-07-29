import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CompleteContractSigningDto } from '../../admin/marketing/dto/prospect-contract.dto';
import { ContractSigningService } from './contract-signing.service';

@Controller('contracts/sign')
export class ContractSigningController {
  constructor(private readonly contractSigningService: ContractSigningService) {}

  @Get(':token')
  getSigningDetails(@Param('token') token: string) {
    return this.contractSigningService.getSigningDetails(token).then((data) => ({
      success: true,
      data,
    }));
  }

  @Post(':token')
  completeSigning(
    @Param('token') token: string,
    @Body() dto: CompleteContractSigningDto,
    @Req() request: Request,
  ) {
    const signatureIp =
      (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
      ?? request.ip
      ?? undefined;

    return this.contractSigningService.completeSigning(token, dto, signatureIp).then((data) => ({
      success: true,
      message: 'Contract signed successfully. Deal status updated to Contract Signed.',
      data,
    }));
  }
}
