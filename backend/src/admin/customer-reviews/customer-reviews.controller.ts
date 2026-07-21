import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CustomerReviewsService } from './customer-reviews.service';
import { UpdateCustomerReviewDto } from './dto/update-customer-review.dto';

@Controller('admin/customer-reviews')
@UseGuards(JwtAuthGuard)
export class CustomerReviewsController {
  constructor(private readonly customerReviewsService: CustomerReviewsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.customerReviewsService.list(page, limit, search, status).then((result) => ({
      success: true,
      data: result.items,
      meta: result.meta,
    }));
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.customerReviewsService.getById(id).then((item) => ({
      success: true,
      data: item,
    }));
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomerReviewDto) {
    return this.customerReviewsService.update(id, dto).then((item) => ({
      success: true,
      message: 'Review updated.',
      data: item,
    }));
  }
}
