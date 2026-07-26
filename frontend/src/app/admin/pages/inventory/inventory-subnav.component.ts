import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-inventory-subnav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="mb-6 flex flex-wrap gap-2">
      <a
        routerLink="/admin/inventory"
        routerLinkActive="bg-pcmazing-500 text-white"
        [routerLinkActiveOptions]="{ exact: true }"
        class="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Stock
      </a>
      <a
        routerLink="/admin/inventory/purchase"
        routerLinkActive="bg-pcmazing-500 text-white"
        class="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Purchase
      </a>
    </nav>
  `,
})
export class InventorySubnavComponent {}
