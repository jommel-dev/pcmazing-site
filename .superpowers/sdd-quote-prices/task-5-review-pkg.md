BASE: be377ca
HEAD: 36b7febd2e80ce7f2fa321ef0f978a703c18c0f7

36b7feb Persist quotation line topup and strip it from public share.
 .../admin/quotation/dto/create-quotation.dto.ts    | 17 ++++
 backend/src/admin/quotation/quotation.service.ts   | 90 ++++++++++++++++++++--
 2 files changed, 101 insertions(+), 6 deletions(-)

## Diff

diff --git a/backend/src/admin/quotation/dto/create-quotation.dto.ts b/backend/src/admin/quotation/dto/create-quotation.dto.ts
index 8cac8e3..d38b912 100644
--- a/backend/src/admin/quotation/dto/create-quotation.dto.ts
+++ b/backend/src/admin/quotation/dto/create-quotation.dto.ts
@@ -37,16 +37,33 @@ class CreateQuotationItemDto {
   quantity!: number;
 
   @IsOptional()
   @IsNumber({ maxDecimalPlaces: 2 })
   @Min(0)
   @Max(999999999.99)
   unitPrice?: number;
 
+  @IsOptional()
+  @IsNumber({ maxDecimalPlaces: 2 })
+  @Min(0)
+  @Max(999999999.99)
+  baseUnitPrice?: number;
+
+  @IsOptional()
+  @IsString()
+  @IsIn(['none', 'fixed', 'percent'])
+  topupMode?: 'none' | 'fixed' | 'percent';
+
+  @IsOptional()
+  @IsNumber({ maxDecimalPlaces: 2 })
+  @Min(0)
+  @Max(999999999.99)
+  topupValue?: number;
+
   @IsOptional()
   @IsString()
   @IsIn(['none', 'senior', 'pwd'])
   discountType?: 'none' | 'senior' | 'pwd';
 }
 
 export class CreateQuotationDto {
   @IsString()
diff --git a/backend/src/admin/quotation/quotation.service.ts b/backend/src/admin/quotation/quotation.service.ts
index 74deffd..de9b661 100644
--- a/backend/src/admin/quotation/quotation.service.ts
+++ b/backend/src/admin/quotation/quotation.service.ts
@@ -7,16 +7,21 @@ import {
 import { randomBytes } from 'crypto';
 import { DatabaseService } from '../../database/database.service';
 import {
   buildPagination,
   buildPaginationMeta,
   tableExists,
 } from '../common/admin-table.util';
 import { CreateQuotationDto } from './dto/create-quotation.dto';
+import {
+  computeChargedUnitPrice,
+  computeLineTopupTotal,
+  TopupMode,
+} from './quotation-topup.util';
 
 export type QuotationSource = 'pcmazing' | 'legacy';
 export type QuotationStatus = 'draft' | 'finalized' | 'expired' | 'converted';
 export type QuotationDiscountType = 'none' | 'senior' | 'pwd';
 export type QuotationSortBy =
   | 'quoteNo'
   | 'quoteDate'
   | 'customerName'
@@ -46,44 +51,52 @@ export interface QuotationListItem {
 
 export interface QuotationItem {
   id: number;
   materialId: number | null;
   materialName: string | null;
   productId: number | null;
   description: string;
   quantity: number;
+  baseUnitPrice?: number;
+  topupMode?: TopupMode;
+  topupValue?: number;
   unitPrice: number;
   sellPrice: number | null;
   discountType: QuotationDiscountType;
   discountPrice: number | null;
   totalSetQty: number | null;
   lineTotal: number;
+  lineTopupTotal?: number;
   remarks: string | null;
   metadata: Record<string, unknown> | null;
 }
 
 export interface QuotationDetail extends QuotationListItem {
   customerAddress: string | null;
   customerContactPerson: string | null;
   customerContactNumber: string | null;
   customerEmail: string | null;
   validityDays: number | null;
   remarks: string | null;
   customDiscount: number;
   subtotal: number;
   discountTotal: number;
+  totalTopup?: number;
   items: QuotationItem[];
   hasShareToken?: boolean;
 }
 
 type NormalizedQuoteItem = {
   materialId: number | null;
   description: string;
   quantity: number;
+  baseUnitPrice: number;
+  topupMode: TopupMode;
+  topupValue: number;
   unitPrice: number;
   discountType: QuotationDiscountType;
   lineTotal: number;
 };
 
 const SORT_COLUMN_MAP: Record<QuotationSortBy, string> = {
   quoteNo: 'quotes.quote_no',
   quoteDate: 'quotes.quote_date',
@@ -378,16 +391,19 @@ export class QuotationService {
 
     const quoteDate = new Date();
     const validityDays = Math.min(365, Math.max(1, Number(existing.validityDays) || 7));
     const expiresAt = new Date(quoteDate.getTime() + validityDays * 24 * 60 * 60 * 1000);
     const items: NormalizedQuoteItem[] = existing.items.map((item) => ({
       materialId: item.materialId,
       description: item.description || item.materialName || 'Item',
       quantity: Number(item.quantity) || 0,
+      baseUnitPrice: Number(item.baseUnitPrice ?? item.unitPrice) || 0,
+      topupMode: this.normalizeTopupMode(item.topupMode),
+      topupValue: Number(item.topupValue ?? 0),
       unitPrice: Number(item.unitPrice) || 0,
       discountType: this.normalizeDiscountType(item.discountType),
       lineTotal: Number(item.lineTotal) || 0,
     }));
     const totals = this.calculateTotals(items, existing.customDiscount ?? 0);
 
     const newId = await this.databaseService.withTransaction(async (client) => {
       const insertResult = await client.query<{ id: number }>(
@@ -536,17 +552,30 @@ export class QuotationService {
       throw new NotFoundException('Quotation was not found or the link has expired.');
     }
 
     const detail = await this.getOwnedById(id);
     if (!detail) {
       throw new NotFoundException('Quotation was not found or the link has expired.');
     }
 
-    return detail;
+    const { totalTopup: _totalTopup, ...publicDetail } = detail;
+    return {
+      ...publicDetail,
+      items: detail.items.map((item) => {
+        const {
+          baseUnitPrice: _baseUnitPrice,
+          topupMode: _topupMode,
+          topupValue: _topupValue,
+          lineTopupTotal: _lineTopupTotal,
+          ...publicItem
+        } = item;
+        return publicItem;
+      }),
+    };
   }
 
   private async getOwnedRawForShare(id: number): Promise<{
     id: number;
     share_token: string | null;
     expires_at: string | null;
     quote_no: string | null;
   }> {
@@ -645,58 +674,73 @@ export class QuotationService {
     }
 
     const itemsResult = await this.databaseService.query<{
       id: number;
       material_id: number | null;
       material_name: string | null;
       description: string;
       quantity: string;
+      base_unit_price: string | null;
+      topup_mode: string | null;
+      topup_value: string | null;
       unit_price: string;
       discount_type: string | null;
       line_total: string;
     }>(
       `SELECT
         i.id,
         i.material_id,
         m.material_name,
         i.description,
         i.quantity::text,
+        i.base_unit_price::text,
+        i.topup_mode,
+        i.topup_value::text,
         i.unit_price::text,
         i.discount_type,
         i.line_total::text
        FROM pcmazing_quotation_items i
        LEFT JOIN tblmaterials m ON m.id = i.material_id
        WHERE i.quotation_id = $1 AND i.deleted_at IS NULL
        ORDER BY i.id ASC`,
       [id],
     );
 
     const items: QuotationItem[] = itemsResult.rows.map((row) => {
       const quantity = Number(row.quantity ?? 0);
       const unitPrice = Number(row.unit_price ?? 0);
+      const baseUnitPrice = Number(row.base_unit_price ?? unitPrice);
+      const topupMode = this.normalizeTopupMode(row.topup_mode);
+      const topupValue = Number(row.topup_value ?? 0);
       const lineTotal = Number(row.line_total ?? 0);
       return {
         id: row.id,
         materialId: row.material_id,
         materialName: row.material_name,
         productId: null,
         description: row.description,
         quantity,
+        baseUnitPrice,
+        topupMode,
+        topupValue,
         unitPrice,
         sellPrice: unitPrice,
         discountType: this.normalizeDiscountType(row.discount_type),
         discountPrice: null,
         totalSetQty: quantity,
         lineTotal,
+        lineTopupTotal: computeLineTopupTotal(baseUnitPrice, unitPrice, quantity),
         remarks: row.description,
         metadata: { description: row.description },
       };
     });
 
+    const totalTopup = items.reduce((sum, item) => sum + Number(item.lineTopupTotal ?? 0), 0);
+
     return {
       ...this.mapListRow({
         source: 'pcmazing',
         id: header.id,
         quote_no: header.quote_no,
         quote_date: header.quote_date,
         customer_name: header.customer_name,
         total_amount: header.total_amount,
@@ -709,16 +753,17 @@ export class QuotationService {
       customerContactPerson: null,
       customerContactNumber: header.customer_contact_number,
       customerEmail: header.customer_email,
       validityDays: header.validity_days,
       remarks: header.remarks,
       customDiscount: Number(header.custom_discount ?? 0),
       subtotal: Number(header.subtotal ?? 0),
       discountTotal: Number(header.discount_total ?? 0),
+      totalTopup,
       items,
       hasShareToken: !!header.share_token,
     };
   }
 
   private async getLegacyById(id: number): Promise<QuotationDetail | null> {
     if (!(await tableExists(this.databaseService, 'tblquotation'))) {
       return null;
@@ -927,43 +972,62 @@ export class QuotationService {
 
       if (!hasMaterial && !customDescription) {
         throw new BadRequestException(
           `Row ${index + 1} needs an inventory item or a custom description.`,
         );
       }
 
       let description = customDescription;
-      let unitPrice =
-        item.unitPrice !== undefined && item.unitPrice !== null ? Number(item.unitPrice) : 0;
+      const topupMode = this.normalizeTopupMode(item.topupMode);
+      const topupValue = Number(item.topupValue ?? 0);
+      let baseUnitPrice =
+        item.baseUnitPrice != null ? Number(item.baseUnitPrice) : Number(item.unitPrice ?? 0);
 
       if (hasMaterial) {
         const material = materialMap.get(materialId);
         if (!material) {
           throw new BadRequestException(`Material ${materialId} was not found.`);
         }
         description = customDescription || material.materialName;
-        if (item.unitPrice === undefined || item.unitPrice === null) {
-          unitPrice = material.sellPrice;
+        if (item.baseUnitPrice == null && (item.unitPrice === undefined || item.unitPrice === null)) {
+          baseUnitPrice = material.sellPrice;
         }
       }
 
+      if (!Number.isFinite(baseUnitPrice) || baseUnitPrice < 0) {
+        throw new BadRequestException(`Row ${index + 1} base unit price must be a non-negative number.`);
+      }
+      if (!Number.isFinite(topupValue) || topupValue < 0) {
+        throw new BadRequestException(`Row ${index + 1} topup value must be a non-negative number.`);
+      }
+
+      let unitPrice: number;
+      try {
+        unitPrice = computeChargedUnitPrice(baseUnitPrice, topupMode, topupValue);
+      } catch {
+        throw new BadRequestException(`Row ${index + 1} topup pricing is invalid.`);
+      }
+
       const quantity = Number(item.quantity);
       if (!Number.isFinite(quantity) || quantity <= 0) {
         throw new BadRequestException(`Row ${index + 1} quantity must be greater than 0.`);
       }
 
       const discountType = this.normalizeDiscountType(item.discountType);
       const gross = quantity * unitPrice;
       const lineTotal = Math.max(0, gross - this.computeLineDiscount(gross, discountType));
 
       return {
         materialId: hasMaterial ? materialId : null,
         description,
         quantity,
+        baseUnitPrice,
+        topupMode,
+        topupValue,
         unitPrice,
         discountType,
         lineTotal,
       };
     });
   }
 
   private async insertItems(
@@ -973,26 +1037,32 @@ export class QuotationService {
   ): Promise<void> {
     for (const item of items) {
       await client.query(
         `INSERT INTO pcmazing_quotation_items (
            quotation_id,
            material_id,
            description,
            quantity,
+           base_unit_price,
+           topup_mode,
+           topup_value,
            unit_price,
            discount_type,
            line_total
          )
-         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
+         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
         [
           quotationId,
           item.materialId,
           item.description,
           item.quantity,
+          item.baseUnitPrice,
+          item.topupMode,
+          item.topupValue,
           item.unitPrice,
           item.discountType,
           item.lineTotal,
         ],
       );
     }
   }
 
@@ -1028,16 +1098,24 @@ export class QuotationService {
   private normalizeDiscountType(value?: string | null): QuotationDiscountType {
     const normalized = String(value ?? 'none').trim().toLowerCase();
     if (normalized === 'senior' || normalized === 'pwd') {
       return normalized;
     }
     return 'none';
   }
 
+  private normalizeTopupMode(value?: string | null): TopupMode {
+    const normalized = String(value ?? 'none').trim().toLowerCase();
+    if (normalized === 'fixed' || normalized === 'percent') {
+      return normalized;
+    }
+    return 'none';
+  }
+
   private normalizeSource(value?: string): QuotationSource | undefined {
     const normalized = String(value ?? '').trim().toLowerCase();
     if (normalized === 'legacy' || normalized === 'pcmazing') {
       return normalized;
     }
     return undefined;
   }
 
