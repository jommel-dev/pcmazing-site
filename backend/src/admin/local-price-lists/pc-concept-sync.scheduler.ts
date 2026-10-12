import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LocalPriceListsService } from './local-price-lists.service';

@Injectable()
export class PcConceptSyncScheduler {
  private readonly logger = new Logger(PcConceptSyncScheduler.name);

  constructor(private readonly localPriceLists: LocalPriceListsService) {}

  @Cron('0 2 * * *', { timeZone: 'Asia/Manila' })
  async handleDailySync(): Promise<void> {
    try {
      const result = await this.localPriceLists.syncPcConceptCatalog();
      this.logger.log(`PC Concept sync: ${result.imported} items`);
    } catch (err) {
      this.logger.warn(
        `PC Concept sync failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
