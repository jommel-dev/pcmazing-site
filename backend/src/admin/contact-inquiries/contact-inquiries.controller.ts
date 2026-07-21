import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContactInquiriesService } from './contact-inquiries.service';
import { UpdateContactInquiryDto } from './dto/update-contact-inquiry.dto';

@Controller('admin/contact-inquiries')
@UseGuards(JwtAuthGuard)
export class ContactInquiriesController {
  constructor(private readonly contactInquiriesService: ContactInquiriesService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.contactInquiriesService.list(page, limit, search, status).then((result) => ({
      success: true,
      data: result.items,
      meta: result.meta,
    }));
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.contactInquiriesService.getById(id).then((item) => ({
      success: true,
      data: item,
    }));
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateContactInquiryDto) {
    return this.contactInquiriesService.update(id, dto).then((item) => ({
      success: true,
      message: 'Contact inquiry updated.',
      data: item,
    }));
  }
}
