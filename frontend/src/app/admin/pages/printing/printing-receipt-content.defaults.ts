export const DEFAULT_STORE_NAME = 'PCmazing Information Technology Services';
export const DEFAULT_STORE_ADDRESS = '10 Nori St. Purok 3, Mabini Extension, Cabanatuan City';
export const DEFAULT_STORE_PHONE = '09394133225';

/** Address block with company phone on the next line (for letterheads / printouts). */
export function storeAddressWithPhone(
  address?: string | null,
  phone?: string | null,
): string {
  const addr = (address?.trim() || DEFAULT_STORE_ADDRESS).trim();
  const tel = (phone?.trim() || DEFAULT_STORE_PHONE).trim();
  if (!tel) {
    return addr;
  }
  if (addr.includes(tel)) {
    return addr;
  }
  return `${addr}\nTel: ${tel}`;
}

export const DEFAULT_WARRANTY_POLICY = `"PCmazing Warranty Policy"
Major PC Parts: 1-Year Warranty, 5-Day Replacement (Factory Defects Only)
PC Accessories: 5-Day Replacement, 1-Month Warranty (Factory Defects Only)
Original Receipt Required — NO RECEIPT, NO WARRANTY
Monitor dead pixels are NOT covered under replacement/warranty.
Physical, liquid, electrical, accidental, or customer-caused damage voids the warranty.
By purchasing this product, you acknowledge that you have read, understood, and accepted the terms and conditions of this warranty policy.`;

export const DEFAULT_FOOTER_NOTE = 'This slip is not valid for input tax';

export const DEFAULT_THANKS_MESSAGE = 'Thanks for shopping with us!';
