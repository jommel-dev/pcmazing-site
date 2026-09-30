import {
  LOCAL_PRICE_LIST_TEMPLATE_CSV,
  parseLocalPriceListCsv,
} from './local-price-list-csv.util';

describe('local-price-list-csv.util', () => {
  it('parses the exported template', () => {
    expect(parseLocalPriceListCsv(LOCAL_PRICE_LIST_TEMPLATE_CSV)).toEqual([
      {
        title: 'Sample GPU 8GB',
        pricePhp: 12500,
        sku: 'SKU-1',
        notes: 'optional note',
      },
    ]);
  });

  it('accepts case-insensitive headers', () => {
    const csv = 'Title,PRICE,SKU,Notes\nWidget,99.5,,';
    expect(parseLocalPriceListCsv(csv)).toEqual([
      { title: 'Widget', pricePhp: 99.5, sku: null, notes: null },
    ]);
  });

  it('skips rows with blank title', () => {
    const csv = 'title,price\n,500\nReal item,100\n';
    expect(parseLocalPriceListCsv(csv)).toEqual([
      { title: 'Real item', pricePhp: 100, sku: null, notes: null },
    ]);
  });

  it('throws when required headers are missing', () => {
    expect(() => parseLocalPriceListCsv('sku,notes\nx,y')).toThrow(/title/i);
    expect(() => parseLocalPriceListCsv('title,sku\nx,y')).toThrow(/price/i);
  });

  it('throws on non-numeric price', () => {
    const csv = 'title,price\nItem,not-a-number';
    expect(() => parseLocalPriceListCsv(csv)).toThrow(/price/i);
  });
});
