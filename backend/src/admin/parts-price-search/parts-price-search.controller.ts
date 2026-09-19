import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PartsPriceSearchService } from './parts-price-search.service';

@Controller('admin/parts-price-search')
@UseGuards(JwtAuthGuard)
export class PartsPriceSearchController {
  constructor(private readonly partsPriceSearchService: PartsPriceSearchService) {}

  @Get('sources')
  listSources() {
    return {
      success: true,
      data: {
        enabled: this.partsPriceSearchService.isEnabled(),
        sources: this.partsPriceSearchService.listAvailableSources(),
      },
    };
  }

  @Get()
  search(
    @Query('q') q?: string,
    @Query('sources') sources?: string,
    @Query('limit') limit?: string,
  ) {
    return this.partsPriceSearchService.search(q ?? '', sources, limit).then((data) => ({
      success: true,
      data,
    }));
  }
}
