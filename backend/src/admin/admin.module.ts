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
import { InventoryServicesController } from './inventory/inventory-services.controller';
import { InventoryServicesService } from './inventory/inventory-services.service';
import { InventoryService } from './inventory/inventory.service';
import { PurchaseController } from './inventory/purchase.controller';
import { PurchaseService } from './inventory/purchase.service';
import { QuotationController } from './quotation/quotation.controller';
import { QuotationService } from './quotation/quotation.service';
import { RbacService } from './rbac/rbac.service';
import { RolesGuard } from './rbac/roles.guard';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { MarketingTeamsController } from './marketing/marketing-teams.controller';
import { MarketingTeamsService } from './marketing/marketing-teams.service';
import { ClientProspectsController } from './marketing/client-prospects.controller';
import { ClientProspectsService } from './marketing/client-prospects.service';
import { CurrencyExchangeService } from './marketing/currency-exchange.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [
    DashboardController,
    ContactInquiriesController,
    CustomerReviewsController,
    DemoRequestsController,
    InventoryController,
    InventoryServicesController,
    PurchaseController,
    QuotationController,
    UsersController,
    MarketingTeamsController,
    ClientProspectsController,
  ],
  providers: [
    DashboardService,
    ContactInquiriesService,
    CustomerReviewsService,
    DemoRequestsService,
    InventoryService,
    InventoryServicesService,
    PurchaseService,
    QuotationService,
    RbacService,
    RolesGuard,
    UsersService,
    MarketingTeamsService,
    ClientProspectsService,
    CurrencyExchangeService,
  ],
})
export class AdminModule {}
