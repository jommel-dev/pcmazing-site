import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from './auth/auth.module';
import { ContactInquiriesController } from './contact-inquiries/contact-inquiries.controller';
import { ContactInquiriesService } from './contact-inquiries/contact-inquiries.service';
import { CustomerReviewsController } from './customer-reviews/customer-reviews.controller';
import { CustomerReviewsService } from './customer-reviews/customer-reviews.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { DemoRequestsController } from './demo-requests/demo-requests.controller';
import { DemoRequestsService } from './demo-requests/demo-requests.service';
import { InventoryController } from './inventory/inventory.controller';
import { InventoryService } from './inventory/inventory.service';
import { QuotationController } from './quotation/quotation.controller';
import { QuotationService } from './quotation/quotation.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [
    DashboardController,
    ContactInquiriesController,
    CustomerReviewsController,
    DemoRequestsController,
    InventoryController,
    QuotationController,
  ],
  providers: [
    DashboardService,
    ContactInquiriesService,
    CustomerReviewsService,
    DemoRequestsService,
    InventoryService,
    QuotationService,
  ],
})
export class AdminModule {}
