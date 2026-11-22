import { CreateSalesOrderDto } from './create-sales-order.dto';

/** Same shape as create — full replace of editable SO fields + line items. */
export class UpdateSalesOrderDto extends CreateSalesOrderDto {}
