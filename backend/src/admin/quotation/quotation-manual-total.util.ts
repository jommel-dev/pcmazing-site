export type ManualTotalInput = {
  useManualTotal?: boolean | null;
  manualTotalAmount?: number | null;
  hideItemPrices?: boolean | null;
  calculatedTotalAmount: number;
};

export type ManualTotalResolved = {
  useManualTotal: boolean;
  manualTotalAmount: number | null;
  hideItemPrices: boolean;
  totalAmount: number;
};

export function resolveManualTotalFlags(input: ManualTotalInput): ManualTotalResolved {
  const useManualTotal = Boolean(input.useManualTotal);
  const calculated = Math.max(0, Number(input.calculatedTotalAmount) || 0);

  if (useManualTotal) {
    if (input.manualTotalAmount == null) {
      throw new Error('Manual total amount is required and must be zero or greater.');
    }
    const manual = Number(input.manualTotalAmount);
    if (!Number.isFinite(manual) || manual < 0) {
      throw new Error('Manual total amount is required and must be zero or greater.');
    }
    return {
      useManualTotal: true,
      manualTotalAmount: manual,
      hideItemPrices: true,
      totalAmount: manual,
    };
  }

  const priorManual = Number(input.manualTotalAmount);
  return {
    useManualTotal: false,
    manualTotalAmount: Number.isFinite(priorManual) ? priorManual : null,
    hideItemPrices: Boolean(input.hideItemPrices),
    totalAmount: calculated,
  };
}
