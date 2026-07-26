import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  AssignableMarketingUser,
  MarketingTeamNode,
} from '../../services/admin-api.service';

@Component({
  selector: 'app-organization-team-page',
  imports: [ReactiveFormsModule],
  templateUrl: './organization-team-page.component.html',
})
export class OrganizationTeamPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly actionMessage = signal('');
  readonly teams = signal<MarketingTeamNode[]>([]);
  readonly users = signal<AssignableMarketingUser[]>([]);
  readonly memberTeamId = signal<number | null>(null);

  readonly teamForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    parentTeamId: [''],
    managerUserId: [''],
  });

  readonly memberForm = this.formBuilder.nonNullable.group({
    userId: [0, [Validators.required, Validators.min(1)]],
    memberRole: ['member', [Validators.required]],
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [teamsResponse, usersResponse] = await Promise.all([
        firstValueFrom(this.adminApi.listMarketingTeams()),
        firstValueFrom(this.adminApi.listAssignableMarketingUsers()),
      ]);
      this.teams.set(teamsResponse.data);
      this.users.set(usersResponse.data);
    } catch {
      this.error.set('Unable to load organization teams.');
    } finally {
      this.loading.set(false);
    }
  }

  flatTeams(): MarketingTeamNode[] {
    const items: MarketingTeamNode[] = [];
    const walk = (nodes: MarketingTeamNode[]) => {
      for (const node of nodes) {
        items.push(node);
        walk(node.children);
      }
    };
    walk(this.teams());
    return items;
  }

  openMemberForm(teamId: number): void {
    this.memberTeamId.set(teamId);
    this.memberForm.reset({ userId: 0, memberRole: 'member' });
  }

  closeMemberForm(): void {
    this.memberTeamId.set(null);
  }

  async submitTeam(): Promise<void> {
    if (this.teamForm.invalid) {
      this.teamForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.actionMessage.set('');
    const value = this.teamForm.getRawValue();

    try {
      await firstValueFrom(
        this.adminApi.createMarketingTeam({
          name: value.name,
          parentTeamId: value.parentTeamId ? Number(value.parentTeamId) : undefined,
          managerUserId: value.managerUserId ? Number(value.managerUserId) : undefined,
        }),
      );
      this.teamForm.reset({ name: '', parentTeamId: '', managerUserId: '' });
      this.actionMessage.set('Marketing team created.');
      await this.load();
    } catch {
      this.error.set('Unable to create marketing team.');
    } finally {
      this.saving.set(false);
    }
  }

  async submitMember(): Promise<void> {
    const teamId = this.memberTeamId();
    if (!teamId || this.memberForm.invalid) {
      this.memberForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const value = this.memberForm.getRawValue();

    try {
      await firstValueFrom(
        this.adminApi.addMarketingTeamMember(teamId, {
          userId: Number(value.userId),
          memberRole: value.memberRole,
        }),
      );
      this.actionMessage.set('Team member added.');
      this.closeMemberForm();
      await this.load();
    } catch {
      this.error.set('Unable to add team member.');
    } finally {
      this.saving.set(false);
    }
  }

  roleLabel(role: string): string {
    return role.replace(/_/g, ' ');
  }
}
