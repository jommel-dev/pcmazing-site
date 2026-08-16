/** Philippine Senior Citizen / PWD discount on VAT-inclusive prices (RA 9994 / RA 10754). */
export type PhDiscountType = 'none' | 'senior' | 'pwd';

export const PH_VAT_RATE = 0.12;
export const PH_SC_PWD_DISCOUNT_RATE = 0.2;

export type PhDiscountBreakdown = {
  type: PhDiscountType;
  gross: number;
  vatExclusive: number;
  net: number;
  vatAmount: number;
  discountAmount: number;
  /** Percentage shown on receipts as sc % (0 or 20). */
  discountPercent: number;
};

export function normalizePhDiscountType(value: unknown): PhDiscountType {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (raw === 'senior' || raw === 'sc' || raw === 'senior_citizen') {
    return 'senior';
  }
  if (raw === 'pwd' || raw === 'person_with_disability') {
    return 'pwd';
  }
  return 'none';
}

export function applyPhSpecialDiscount(
  grossInput: number,
  typeInput: PhDiscountType | string | null | undefined,
): PhDiscountBreakdown {
  const type = normalizePhDiscountType(typeInput);
  const gross = Math.max(0, Number(grossInput) || 0);

  if (type === 'none' || gross <= 0) {
    return {
      type: 'none',
      gross,
      vatExclusive: gross,
      net: gross,
      vatAmount: 0,
      discountAmount: 0,
      discountPercent: 0,
    };
  }

  const vatExclusive = gross / (1 + PH_VAT_RATE);
  const net = vatExclusive * (1 - PH_SC_PWD_DISCOUNT_RATE);

  return {
    type,
    gross,
    vatExclusive,
    net,
    vatAmount: gross - vatExclusive,
    discountAmount: gross - net,
    discountPercent: PH_SC_PWD_DISCOUNT_RATE * 100,
  };
}

export function applyLineDiscount(grossInput: number, discountInput: number): {
  gross: number;
  discountAmount: number;
  net: number;
} {
  const gross = Math.max(0, Number(grossInput) || 0);
  const discountAmount = Math.min(gross, Math.max(0, Number(discountInput) || 0));
  return {
    gross,
    discountAmount,
    net: Math.max(0, gross - discountAmount),
  };
}

export function phDiscountLabel(type: PhDiscountType): string {
  switch (type) {
    case 'senior':
      return 'Senior Citizen (20%)';
    case 'pwd':
      return 'PWD (20%)';
    default:
      return 'No discount';
  }
}
