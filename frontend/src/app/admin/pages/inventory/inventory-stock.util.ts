import { MaterialItem } from '../../services/admin-api.service';

export function formatInventoryMoney(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  return amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function unitCost(item: MaterialItem): number {
  return item.unitPrice ?? 0;
}

export function unitOrderCost(item: MaterialItem): number {
  return item.orderCost ?? 0;
}

export function unitPrice(item: MaterialItem): number {
  return item.sellPrice ?? 0;
}

export function unitMargin(item: MaterialItem): number {
  return unitPrice(item) - unitOrderCost(item);
}

export function stockQty(item: MaterialItem): number {
  return item.onHandStock ?? 0;
}

export function isMaterialInStock(item: MaterialItem): boolean {
  return stockQty(item) > 0;
}

export function extendedCost(item: MaterialItem): number {
  return unitOrderCost(item) * stockQty(item);
}

export function extendedPrice(item: MaterialItem): number {
  return unitPrice(item) * stockQty(item);
}

export function extendedMargin(item: MaterialItem): number {
  return unitMargin(item) * stockQty(item);
}

export function stockStatusLabel(item: MaterialItem): string {
  const stock = stockQty(item);
  const reorder = item.reorderLevel ?? 0;
  if (stock <= 0) {
    return 'Out of Stock';
  }
  if (stock <= reorder) {
    return 'Low Stock';
  }
  return 'Normal';
}

export function stockStatusClass(label: string): string {
  if (label === 'Out of Stock') {
    return 'bg-red-50 text-red-700';
  }
  if (label === 'Low Stock') {
    return 'bg-amber-50 text-amber-700';
  }
  return 'bg-emerald-50 text-emerald-700';
}
