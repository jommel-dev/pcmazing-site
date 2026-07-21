import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  viewChild,
} from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

Chart.register(
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend,
);

export type DashboardChartKind = 'line' | 'bar' | 'doughnut';

@Component({
  selector: 'app-dashboard-chart',
  template: `<div class="relative h-72 w-full"><canvas #canvas></canvas></div>`,
})
export class DashboardChartComponent implements AfterViewInit, OnDestroy {
  readonly kind = input.required<DashboardChartKind>();
  readonly labels = input<string[]>([]);
  readonly values = input<number[]>([]);
  readonly colors = input<string[]>(['#2563eb', '#16a34a', '#f59e0b', '#94a3b8']);
  readonly currency = input(false);

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart: Chart | null = null;
  private viewReady = false;

  constructor() {
    effect(() => {
      this.labels();
      this.values();
      this.colors();
      this.kind();
      this.currency();

      if (this.viewReady) {
        this.renderChart();
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    const canvas = this.canvasRef().nativeElement;
    const labels = this.labels();
    const values = this.values();
    const colors = this.colors();
    const kind = this.kind();

    this.chart?.destroy();

    const config = this.buildConfig(kind, labels, values, colors);
    this.chart = new Chart(canvas, config as ChartConfiguration);
  }

  private buildConfig(
    kind: DashboardChartKind,
    labels: string[],
    values: number[],
    colors: string[],
  ): ChartConfiguration<'line' | 'bar' | 'doughnut'> {
    const currency = this.currency();

    if (kind === 'doughnut') {
      return {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: colors,
              borderWidth: 0,
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 12, boxHeight: 12, padding: 16 },
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const value = Number(context.raw ?? 0);
                  return `${context.label}: ${value.toLocaleString('en-PH')}`;
                },
              },
            },
          },
        },
      } as ChartConfiguration<'doughnut'>;
    }

    const datasetColor = colors[0] ?? '#2563eb';

    return {
      type: kind,
      data: {
        labels,
        datasets: [
          {
            label: kind === 'bar' ? 'Amount' : 'Count',
            data: values,
            borderColor: datasetColor,
            backgroundColor: kind === 'bar' ? `${datasetColor}33` : `${datasetColor}22`,
            borderWidth: kind === 'line' ? 2.5 : 1,
            tension: 0.35,
            fill: kind === 'line',
            pointRadius: 4,
            pointHoverRadius: 6,
            borderRadius: kind === 'bar' ? 8 : 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = Number(context.raw ?? 0);
                const formatted = currency
                  ? `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`
                  : value.toLocaleString('en-PH');
                return formatted;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', maxRotation: 0, autoSkipPadding: 12 },
          },
          y: {
            beginAtZero: true,
            grid: { color: '#e2e8f0' },
            ticks: {
              color: '#64748b',
              callback: (value) => {
                const numeric = Number(value);
                return currency
                  ? `₱${numeric.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`
                  : numeric.toLocaleString('en-PH');
              },
            },
          },
        },
      },
    };
  }
}
