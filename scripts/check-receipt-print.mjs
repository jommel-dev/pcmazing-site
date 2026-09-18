import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const failures = [];

function read(relPath) {
  return readFileSync(resolve(root, relPath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

const util = read('frontend/src/app/admin/pages/printing/printing-print-page.util.ts');
assert(util.includes('A4_PRINT_WIDTH_MM = 210'), 'A4 width must be 210mm');
assert(util.includes('A4_PRINT_HEIGHT_MM = 297'), 'A4 height must be 297mm');
assert(util.includes('A4_PRINT_MARGIN_MM = 8'), 'Print margin must be 8mm on every side');
assert(util.includes('margin: ${margin}mm'), 'Page margin must use one equal value');
assert(util.includes('print-color-adjust: exact'), 'Barcode ink must print');
assert(util.includes("bar.filled ? '#111'"), 'Filled barcode bars must be black');

const styles = read('frontend/src/styles.css');
assert(/@page\s*\{[\s\S]*size:\s*A4[\s\S]*margin:\s*8mm/.test(styles), 'Global print page must be A4 with 8mm equal margins');

for (const css of [
  'frontend/src/app/admin/pages/inventory/inventory-service-receipt-page.component.css',
  'frontend/src/app/admin/pages/inventory/sales-order-receipt-page.component.css',
]) {
  const text = read(css);
  assert(text.includes('width: 210mm'), `${css} must preview at A4 width`);
  assert(text.includes('padding: 8mm'), `${css} must use equal 8mm padding`);
  assert(text.includes('span.bar-on'), `${css} must style printable barcode bars`);
  assert(text.includes('print-color-adjust: exact'), `${css} must keep barcode color when printing`);
  assert(text.includes('margin-top: 0.15rem'), `${css} must keep the signature close to the barcode`);
}

for (const html of [
  'frontend/src/app/admin/pages/inventory/inventory-service-receipt-page.component.html',
  'frontend/src/app/admin/pages/inventory/sales-order-receipt-page.component.html',
]) {
  const text = read(html);
  assert(text.includes('barcodeBarStyle(bar)'), `${html} must apply barcode bar colors`);
  assert(text.includes('class.bar-on'), `${html} must mark filled barcode bars`);
}

const layout = read('frontend/src/app/admin/pages/printing/printing.types.ts');
assert(layout.includes('y: 243'), 'Thanks message should sit closer to the barcode');
assert(layout.includes('y: 248'), 'Barcode should sit under the thanks message');
assert(layout.includes('y: 264'), 'Signature should sit just under the barcode');

if (failures.length) {
  console.error('Receipt print checks failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Receipt print checks passed: A4 base, equal 8mm margins, barcode ink, tighter footer.');
