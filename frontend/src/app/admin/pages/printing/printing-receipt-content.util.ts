import { PrintLayoutElement } from './printing.types';

export type ReceiptContentFieldKey = 'warrantyPolicy' | 'footerNote' | 'thanksMessage';

type ReceiptContentElement = {
  type?: string;
  fieldKey?: string | null;
  id?: string;
  label?: string;
  content?: string;
};

export function receiptContentFieldKeyFor(
  element: ReceiptContentElement,
): ReceiptContentFieldKey | null {
  const fieldKey = String(element.fieldKey || '').trim();
  if (fieldKey === 'warrantyPolicy' || fieldKey === 'footerNote' || fieldKey === 'thanksMessage') {
    return fieldKey;
  }

  const idLabel = `${element.id || ''} ${element.label || ''}`.toLowerCase();
  if (idLabel.includes('warranty')) {
    return 'warrantyPolicy';
  }
  if (
    idLabel.includes('footer_note') ||
    idLabel.includes('footer-note') ||
    idLabel.includes('footer note') ||
    idLabel.includes('tax note')
  ) {
    return 'footerNote';
  }
  if (idLabel.includes('thanks') || idLabel.includes('thank-you') || idLabel.includes('thank you')) {
    return 'thanksMessage';
  }

  const content = String(element.content || '').toLowerCase();
  if (
    content.includes('warranty policy') ||
    content.includes('no receipt, no warranty') ||
    content.includes('no receipt — no warranty')
  ) {
    return 'warrantyPolicy';
  }
  if (content.includes('not valid for input tax')) {
    return 'footerNote';
  }
  if (content.includes('thanks for shopping')) {
    return 'thanksMessage';
  }

  return null;
}

export function bindLiveReceiptContentFields<T extends ReceiptContentElement>(
  elements: T[],
): T[] {
  return elements.map((element) => {
    const fieldKey = receiptContentFieldKeyFor(element);
    if (!fieldKey) {
      return element;
    }
    return {
      ...element,
      type: 'field',
      fieldKey,
    } as T;
  });
}

export function compactReceiptText(value: string): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export type ReceiptContentPreview = {
  warrantyPolicy?: string;
  footerNote?: string;
  thanksMessage?: string;
};

export function estimateWrappedTextHeightMm(
  text: string,
  widthMm: number,
  fontSizePt = 10,
): number {
  const source = compactReceiptText(text);
  if (!source.trim()) {
    return 8;
  }

  const fontMm = fontSizePt * 0.352777;
  const charWidthMm = fontMm * 0.55;
  const usableWidth = Math.max(12, widthMm - 4);
  const charsPerLine = Math.max(8, Math.floor(usableWidth / charWidthMm));
  const lineCount = source.split(/\r?\n/).reduce((sum, line) => {
    const length = Math.max(1, line.length);
    return sum + Math.ceil(length / charsPerLine);
  }, 0);
  const lineHeightMm = fontMm * 1.45;
  return Math.max(12, Math.ceil(lineCount * lineHeightMm + 18));
}

export function expandReceiptContentElements<T extends ReceiptContentElement & { y: number; height?: number; width?: number; fontSize?: number }>(
  elements: T[],
  content: ReceiptContentPreview,
): T[] {
  if (!elements.length) {
    return elements;
  }

  const extras: Array<{ id?: string; y: number; extra: number }> = [];
  const sized = elements.map((element) => {
    const key = receiptContentFieldKeyFor(element);
    if (!key) {
      return element;
    }

    const text = content[key] || element.content || '';
    const needed = estimateWrappedTextHeightMm(
      text,
      Number(element.width) || 170,
      Number(element.fontSize) || 10,
    );
    const current = Number(element.height) || 8;
    const extra = needed - current;
    if (Math.abs(extra) > 0.5) {
      extras.push({ id: element.id, y: element.y, extra });
      return { ...element, height: needed };
    }
    return element;
  });

  if (!extras.length) {
    return sized;
  }

  return sized.map((element) => {
    const shift = extras
      .filter((item) => item.id !== element.id && element.y >= item.y + 0.01)
      .reduce((sum, item) => sum + item.extra, 0);
    if (Math.abs(shift) < 0.5) {
      return element;
    }
    return { ...element, y: Math.round((element.y + shift) * 100) / 100 };
  });
}

export function layoutBottomMm(elements: Array<{ y: number; height?: number }>): number {
  if (!elements.length) {
    return 0;
  }
  return Math.max(...elements.map((element) => element.y + (Number(element.height) || 8)));
}

export function applyLiveReceiptContentLayout<
  T extends ReceiptContentElement & { y: number; height?: number; width?: number; fontSize?: number },
>(elements: T[], content: ReceiptContentPreview): T[] {
  return expandReceiptContentElements(bindLiveReceiptContentFields(elements), content);
}

export function fitReceiptTemplate<
  T extends {
    paperHeightMm?: number;
    layout?: { elements?: Array<ReceiptContentElement & { y: number; height?: number; width?: number; fontSize?: number }> };
  },
>(template: T, content: ReceiptContentPreview): T {
  const elements = applyLiveReceiptContentLayout(template.layout?.elements ?? [], content);
  const paperHeightMm = Math.max(
    Number(template.paperHeightMm) || 297,
    Math.ceil(layoutBottomMm(elements) + 10),
  );
  return {
    ...template,
    paperHeightMm,
    layout: {
      ...(template.layout || { elements }),
      elements,
    },
  };
}
