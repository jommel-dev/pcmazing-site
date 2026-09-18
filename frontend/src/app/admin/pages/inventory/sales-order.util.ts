import {
  SalesOrderDetail,
  SalesOrderItem,
  SalesOrderListItem,
} from '../../services/admin-api.service';

export function normalizeSalesOrderItem(item: SalesOrderItem): SalesOrderItem {
  const quantity = Number(item.quantity) || 0;
  const refundedQuantity = Number(item.refundedQuantity) || 0;

  return {
    ...item,
    id: Number(item.id),
    materialId: Number(item.materialId),
    quantity,
    refundedQuantity,
    refundableQuantity: Math.max(0, Number(item.refundableQuantity ?? quantity - refundedQuantity)),
    unitPrice: Number(item.unitPrice) || 0,
  };
}

export function normalizeSalesOrderListItem(item: SalesOrderListItem): SalesOrderListItem {
  const totalAmount = Number(item.totalAmount) || 0;
  const refundAmount = Number(item.refundAmount) || 0;

  return {
    ...item,
    refundAmount,
    netTotalAmount: Number(item.netTotalAmount ?? totalAmount - refundAmount) || 0,
  };
}

export function normalizeSalesOrderDetail(order: SalesOrderDetail): SalesOrderDetail {
  return {
    ...normalizeSalesOrderListItem(order),
    items: (order.items ?? []).map((item) => normalizeSalesOrderItem(item)),
  };
}
