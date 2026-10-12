import {
  extractPccDataJson,
  mapPcConceptProducts,
} from './pc-concept-catalog.util';

describe('pc-concept-catalog.util', () => {
  const sample = `/* gen */\nwindow.PCC_DATA=${JSON.stringify({
    settings: { markup: 15 },
    products: [
      {
        id: 'a',
        sku: 'SKU-A',
        name: 'Item A',
        brand: 'X',
        cat: 'storage',
        specs: 'SATA',
        price: 1000,
        sale: 900,
        stock: { cab: 1, pam: 0 },
        hidden: false,
      },
      {
        id: 'b',
        sku: 'SKU-B',
        name: 'Hidden',
        brand: 'X',
        cat: 'ram',
        specs: '',
        price: 50,
        sale: 0,
        stock: { cab: 0, pam: 0 },
        hidden: true,
      },
      {
        id: 'c',
        sku: '',
        name: 'No sku',
        brand: 'Y',
        cat: 'ram',
        specs: '',
        price: 0,
        sale: 0,
        stock: { cab: 0, pam: 0 },
        hidden: false,
      },
      {
        id: 'd',
        sku: 'SKU-A',
        name: 'Dup sku second',
        brand: 'Z',
        cat: 'ram',
        specs: '',
        price: 200,
        sale: 0,
        stock: { cab: 0, pam: 0 },
        hidden: false,
      },
    ],
  })};`;

  it('extracts PCC_DATA JSON', () => {
    const data = extractPccDataJson(sample) as { products: unknown[] };
    expect(data.products).toHaveLength(4);
  });

  it('maps regular price, skips hidden/invalid, first-wins SKU', () => {
    const items = mapPcConceptProducts(extractPccDataJson(sample));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'Item A',
      sku: 'SKU-A',
      pricePhp: 1000,
    });
    expect(items[0].notes).toContain('X');
    expect(items[0].notes).toMatch(/Cab:\s*1/i);
  });

  it('throws on missing PCC_DATA', () => {
    expect(() => extractPccDataJson('window.FOO={}')).toThrow(/PCC_DATA/i);
  });
});
