import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { canAccessModuleWithPermissions } from '../../rbac/admin-permissions';
import type { AdminModuleKey } from '../../rbac/admin-roles';
import { AdminAuthService } from '../../services/admin-auth.service';

@Component({
  selector: 'app-settings-shell-page',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './settings-shell-page.component.html',
})
export class SettingsShellPageComponent {
  private readonly adminAuth = inject(AdminAuthService);

  canSee(moduleKey: AdminModuleKey): boolean {
    const user = this.adminAuth.getStoredUser();
    return canAccessModuleWithPermissions(
      {
        role: user?.role,
        permissionKeys: user?.permissionKeys,
        payrollEnabled: Boolean(user?.payrollEnabled),
      },
      moduleKey,
    );
  }
}
