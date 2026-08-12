import {
  Component,
  ElementRef,
  HostListener,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { sampleForField } from './printing-fields.data';
import { CANVAS_SCALE, PrintLayoutElement, roundMm } from './printing.types';

type DragState = {
  elementId: string;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
};

@Component({
  selector: 'app-printing-template-canvas',
  template: `
    <div
      #canvasRoot
      class="template-canvas-root"
      [style.width.px]="paperWidthMm() * scale()"
      [style.height.px]="paperHeightMm() * scale()"
      (mousedown)="onCanvasBackgroundClick($event)"
    >
      <div
        class="template-canvas-margin"
        [style.left.px]="marginLeftMm() * scale()"
        [style.top.px]="marginTopMm() * scale()"
        [style.right.px]="marginRightMm() * scale()"
        [style.bottom.px]="marginBottomMm() * scale()"
      ></div>

      @for (element of elements(); track element.id) {
        <div
          class="template-element"
          [class.selected]="selectedElementId() === element.id"
          [class.type-line]="element.type === 'line'"
          [class.type-table]="element.type === 'table'"
          [class.type-image]="element.type === 'image'"
          [style.left.px]="element.x * scale()"
          [style.top.px]="element.y * scale()"
          [style.width.px]="(element.width || defaultWidth(element)) * scale()"
          [style.height.px]="(element.height || defaultHeight(element)) * scale()"
          [style.font-size.px]="(element.fontSize || 11) * (scale() / 3)"
          [style.font-weight]="element.fontWeight || 'normal'"
          [style.text-align]="element.textAlign || 'left'"
          (mousedown)="startDrag($event, element)"
          (click)="$event.stopPropagation()"
        >
          @switch (element.type) {
            @case ('line') {
              <span class="line-stroke"></span>
            }
            @case ('image') {
              <span class="image-placeholder">{{ element.label || 'Image' }}</span>
            }
            @case ('table') {
              <span class="table-placeholder">{{ element.label || 'Table' }}</span>
              <span class="table-hint">{{ previewValue(element) }}</span>
            }
            @case ('text') {
              {{ element.content || element.label || 'Text' }}
            }
            @default {
              @if (element.fieldKey === 'barcode') {
                <div class="barcode-preview" [style.align-items]="barcodeAlignItems(element)">
                  <span class="barcode-bars" aria-hidden="true"></span>
                  <span class="barcode-sample">{{ previewValue(element) }}</span>
                </div>
              } @else {
                <span class="field-label">{{ element.label || element.fieldKey }}</span>
                <span class="field-value">{{ previewValue(element) }}</span>
              }
            }
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .template-canvas-root {
        position: relative;
        margin: 0 auto;
        background: #fff;
        border: 1px solid #cbd5e1;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
        user-select: none;
      }

      .template-canvas-margin {
        position: absolute;
        border: 1px dashed #dbeafe;
        pointer-events: none;
      }

      .template-element {
        position: absolute;
        border: 1px dashed transparent;
        padding: 2px 4px;
        color: #0f172a;
        cursor: grab;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.72);
      }

      .template-element.selected {
        border-color: #2563eb;
        background: rgba(219, 234, 254, 0.55);
        z-index: 2;
      }

      .template-element.type-line {
        padding: 0;
        background: transparent;
        display: flex;
        align-items: center;
      }

      .line-stroke {
        display: block;
        width: 100%;
        height: 0;
        border-top: 2px solid #111;
      }

      .template-element.type-image,
      .template-element.type-table {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        background: #f8fafc;
      }

      .image-placeholder,
      .table-placeholder {
        font-size: 0.85em;
        font-weight: 700;
      }

      .table-hint,
      .field-value {
        display: block;
        margin-top: 2px;
        font-size: 0.78em;
        color: #64748b;
      }

      .field-label {
        display: block;
        font-size: 0.72em;
        font-weight: 700;
        color: #334155;
      }

      .barcode-preview {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        justify-content: center;
        gap: 2px;
      }

      .barcode-bars {
        display: inline-flex;
        width: 72%;
        max-width: 100%;
        height: 55%;
        min-height: 10px;
        background: repeating-linear-gradient(
          90deg,
          #111 0 2px,
          transparent 2px 4px
        );
      }

      .barcode-sample {
        font-size: 0.72em;
        color: #64748b;
      }
    `,
  ],
})
export class PrintingTemplateCanvasComponent {
  readonly elements = input.required<PrintLayoutElement[]>();
  readonly paperWidthMm = input.required<number>();
  readonly paperHeightMm = input.required<number>();
  readonly marginTopMm = input(0);
  readonly marginRightMm = input(0);
  readonly marginBottomMm = input(0);
  readonly marginLeftMm = input(0);
  readonly selectedElementId = input<string | null>(null);
  readonly scale = input(CANVAS_SCALE);

  readonly elementSelect = output<string>();
  readonly elementsChange = output<PrintLayoutElement[]>();
  readonly canvasBackgroundClick = output<void>();

  private readonly canvasRoot = viewChild<ElementRef<HTMLElement>>('canvasRoot');
  private readonly dragState = signal<DragState | null>(null);

  defaultWidth(element: PrintLayoutElement): number {
    if (element.type === 'line') {
      return 40;
    }
    if (element.type === 'image') {
      return 24;
    }
    return 30;
  }

  defaultHeight(element: PrintLayoutElement): number {
    if (element.type === 'line') {
      return 2;
    }
    if (element.type === 'image') {
      return 14;
    }
    if (element.type === 'table') {
      return 40;
    }
    return 8;
  }

  previewValue(element: PrintLayoutElement): string {
    if (element.type === 'text') {
      return element.content || 'Text';
    }
    return sampleForField(element.fieldKey);
  }

  barcodeAlignItems(element: PrintLayoutElement): string {
    const align = element.textAlign || 'center';
    if (align === 'right') {
      return 'flex-end';
    }
    if (align === 'center') {
      return 'center';
    }
    return 'flex-start';
  }

  onCanvasBackgroundClick(event: MouseEvent): void {
    if (event.target === this.canvasRoot()?.nativeElement) {
      this.canvasBackgroundClick.emit();
    }
  }

  startDrag(event: MouseEvent, element: PrintLayoutElement): void {
    event.preventDefault();
    event.stopPropagation();
    this.elementSelect.emit(element.id);
    this.dragState.set({
      elementId: element.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: element.x,
      originY: element.y,
    });
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    const drag = this.dragState();
    if (!drag) {
      return;
    }

    const deltaX = (event.clientX - drag.startClientX) / this.scale();
    const deltaY = (event.clientY - drag.startClientY) / this.scale();
    const maxX = this.paperWidthMm() - 1;
    const maxY = this.paperHeightMm() - 1;

    const next = this.elements().map((element) => {
      if (element.id !== drag.elementId) {
        return element;
      }
      return {
        ...element,
        x: roundMm(Math.max(0, Math.min(maxX, drag.originX + deltaX))),
        y: roundMm(Math.max(0, Math.min(maxY, drag.originY + deltaY))),
      };
    });

    this.elementsChange.emit(next);
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.dragState.set(null);
  }
}
