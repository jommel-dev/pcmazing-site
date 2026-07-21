import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ADMIN_MODULES, AdminModuleItem } from '../../data/admin-modules.data';

@Component({
  selector: 'app-admin-module-placeholder-page',
  imports: [RouterLink],
  templateUrl: './admin-module-placeholder-page.component.html',
})
export class AdminModulePlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly module: AdminModuleItem | undefined = ADMIN_MODULES.find(
    (item) => item.route.endsWith(`/modules/${this.route.snapshot.paramMap.get('moduleKey') ?? ''}`),
  );
}
