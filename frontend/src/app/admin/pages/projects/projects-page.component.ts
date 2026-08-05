import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { isDeveloperOrPm, isSuperAdmin } from '../../rbac/admin-roles';
import {
  AdminApiService,
  ProjectListItem,
  ProjectUserSummary,
} from '../../services/admin-api.service';
import { AdminAuthService } from '../../services/admin-auth.service';

@Component({
  selector: 'app-projects-page',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './projects-page.component.html',
})
export class ProjectsPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly projects = signal<ProjectListItem[]>([]);
  readonly search = signal('');
  readonly createProjectOpen = signal(false);
  readonly createProjectLoading = signal(false);
  readonly createProjectSaving = signal(false);
  readonly createProjectError = signal('');
  readonly formPage = signal(false);
  readonly projectId = signal<number | null>(null);
  readonly managers = signal<ProjectUserSummary[]>([]);
  readonly developers = signal<ProjectUserSummary[]>([]);
  readonly selectedManagerKey = signal('');
  readonly managerSearch = signal('');
  readonly selectedDeveloperKeys = signal<string[]>([]);
  readonly developerSearch = signal('');
  readonly activeModuleTab = signal(0);
  readonly activeMilestoneTab = signal(0);
  readonly activePaymentTab = signal(0);

  readonly createForm = this.formBuilder.nonNullable.group({
    clientName: ['', [Validators.required, Validators.minLength(2)]],
    company: [''],
    email: ['', [Validators.email]],
    phone: [''],
    address: [''],
    notes: [''],
    projectName: ['', [Validators.required]],
    projectType: ['', [Validators.required]],
    signedAt: [this.todayIsoDate(), [Validators.required]],
    contractRemarks: [''],
    modules: this.formBuilder.array([this.createModuleGroup()]),
    milestones: this.formBuilder.array([this.createMilestoneGroup()]),
    paymentSchedule: this.formBuilder.array([this.createPaymentScheduleGroup()]),
  });

  readonly isMyProjects = computed(() => {
    const role = this.adminAuth.getStoredUser()?.role;
    return isDeveloperOrPm(role) && !isSuperAdmin(role);
  });

  readonly filteredManagers = computed(() => {
    const query = this.managerSearch().trim().toLowerCase().replace(/^@/, '');
    const selectedKey = this.selectedManagerKey();

    return this.managers().filter((manager) => {
      if (this.userKey(manager) === selectedKey) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [
        manager.fullName,
        manager.username,
        manager.role,
        manager.email ?? '',
      ].some((value) => value.toLowerCase().includes(query));
    });
  });

  readonly filteredDevelopers = computed(() => {
    const query = this.developerSearch().trim().toLowerCase().replace(/^@/, '');
    const selectedKeys = new Set(this.selectedDeveloperKeys());

    return this.developers().filter((developer) => {
      if (selectedKeys.has(this.userKey(developer))) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [
        developer.fullName,
        developer.username,
        developer.role,
        developer.email ?? '',
      ].some((value) => value.toLowerCase().includes(query));
    });
  });

  readonly selectedManager = computed(() =>
    this.managers().find((manager) => this.userKey(manager) === this.selectedManagerKey()) ?? null,
  );

  readonly selectedDevelopers = computed(() => {
    const keys = new Set(this.selectedDeveloperKeys());
    return this.developers().filter((developer) => keys.has(this.userKey(developer)));
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const isNewRoute = this.route.snapshot.routeConfig?.path === 'projects/new';
    if (isNewRoute || Number.isInteger(id) && id > 0) {
      this.formPage.set(true);
      this.projectId.set(Number.isInteger(id) && id > 0 ? id : null);
      void this.loadProjectForm();
      return;
    }

    void this.load();
  }

  isUpdateMode(): boolean {
    return this.projectId() !== null;
  }

  cancelRoute(): string[] {
    const id = this.projectId();
    return id ? ['/admin/projects', String(id)] : ['/admin/projects'];
  }

  filteredProjects(): ProjectListItem[] {
    const query = this.search().trim().toLowerCase();
    if (!query) {
      return this.projects();
    }

    return this.projects().filter((project) => {
      const haystack = [
        project.name,
        project.projectType ?? '',
        project.clientName,
        project.company ?? '',
        project.projectManager?.fullName ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  get modulesForm(): FormArray {
    return this.createForm.controls.modules;
  }

  get milestonesForm(): FormArray {
    return this.createForm.controls.milestones;
  }

  get paymentScheduleForm(): FormArray {
    return this.createForm.controls.paymentSchedule;
  }

  modulesControls(): FormGroup[] {
    return this.modulesForm.controls as FormGroup[];
  }

  milestonesControls(): FormGroup[] {
    return this.milestonesForm.controls as FormGroup[];
  }

  paymentScheduleControls(): FormGroup[] {
    return this.paymentScheduleForm.controls as FormGroup[];
  }

  userKey(user: ProjectUserSummary): string {
    return `${user.source}:${user.id}`;
  }

  toggleDeveloper(user: ProjectUserSummary): void {
    const key = this.userKey(user);
    const current = [...this.selectedDeveloperKeys()];
    const index = current.indexOf(key);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(key);
    }
    this.selectedDeveloperKeys.set(current);
    this.developerSearch.set('');
  }

  clearDeveloper(user: ProjectUserSummary): void {
    const key = this.userKey(user);
    this.selectedDeveloperKeys.set(this.selectedDeveloperKeys().filter((item) => item !== key));
  }

  selectManager(manager: ProjectUserSummary): void {
    this.selectedManagerKey.set(this.userKey(manager));
    this.managerSearch.set('');
  }

  clearManager(): void {
    this.selectedManagerKey.set('');
    this.managerSearch.set('');
  }

  async openCreateProjectModal(): Promise<void> {
    await this.router.navigate(['/admin/projects/new']);
  }

  closeCreateProjectModal(): void {
    void this.router.navigate(this.cancelRoute());
  }

  moduleLabel(index: number): string {
    const name = String(this.modulesForm.at(index)?.get('name')?.value ?? '').trim();
    return name || `Module ${index + 1}`;
  }

  milestoneLabel(index: number): string {
    const title = String(this.milestonesForm.at(index)?.get('title')?.value ?? '').trim();
    return title || `Milestone ${index + 1}`;
  }

  addModule(): void {
    this.modulesForm.push(this.createModuleGroup());
    this.activeModuleTab.set(this.modulesForm.length - 1);
  }

  removeModule(index: number): void {
    if (this.modulesForm.length <= 1) {
      return;
    }

    this.modulesForm.removeAt(index);
    this.reindexMilestoneModuleLinks(index);
    this.activeModuleTab.set(Math.min(this.activeModuleTab(), this.modulesForm.length - 1));
  }

  addMilestone(): void {
    this.milestonesForm.push(this.createMilestoneGroup());
    this.activeMilestoneTab.set(this.milestonesForm.length - 1);
  }

  removeMilestone(index: number): void {
    if (this.milestonesForm.length <= 1) {
      return;
    }

    this.milestonesForm.removeAt(index);
    this.reindexPaymentMilestoneLinks(index);
    this.activeMilestoneTab.set(Math.min(this.activeMilestoneTab(), this.milestonesForm.length - 1));
  }

  addPaymentSchedule(): void {
    this.paymentScheduleForm.push(this.createPaymentScheduleGroup());
    this.activePaymentTab.set(this.paymentScheduleForm.length - 1);
  }

  removePaymentSchedule(index: number): void {
    if (this.paymentScheduleForm.length <= 1) {
      return;
    }

    this.paymentScheduleForm.removeAt(index);
    this.activePaymentTab.set(Math.min(this.activePaymentTab(), this.paymentScheduleForm.length - 1));
  }

  isMilestoneModuleLinked(milestoneIndex: number, moduleIndex: number): boolean {
    const value = this.milestonesForm.at(milestoneIndex)?.get('connectedModuleId')?.value;
    return this.parseLinkedIndexes(value).includes(moduleIndex);
  }

  availableModuleIndexesForMilestone(milestoneIndex: number): number[] {
    const currentLinked = new Set(
      this.parseLinkedIndexes(this.milestonesForm.at(milestoneIndex)?.get('connectedModuleId')?.value),
    );
    const linkedByOtherMilestones = this.linkedModuleIndexesByOtherMilestones(milestoneIndex);

    return this.modulesControls()
      .map((_, index) => index)
      .filter((index) => currentLinked.has(index) || !linkedByOtherMilestones.has(index));
  }

  toggleMilestoneModuleLink(milestoneIndex: number, moduleIndex: number): void {
    const control = this.milestonesForm.at(milestoneIndex)?.get('connectedModuleId');
    if (!control) {
      return;
    }

    const current = this.parseLinkedIndexes(control.value);
    const existing = current.indexOf(moduleIndex);
    if (existing >= 0) {
      current.splice(existing, 1);
    } else {
      if (this.linkedModuleIndexesByOtherMilestones(milestoneIndex).has(moduleIndex)) {
        return;
      }
      current.push(moduleIndex);
    }

    control.setValue(current.sort((a, b) => a - b).join(','));
  }

  paymentMilestoneLabel(index: number): string {
    const linked = String(this.paymentScheduleForm.at(index)?.get('connectedMilestoneId')?.value ?? '');
    if (linked === '') {
      return 'No milestone linked';
    }
    const milestoneIndex = Number(linked);
    if (!Number.isInteger(milestoneIndex) || milestoneIndex < 0) {
      return 'No milestone linked';
    }
    return this.milestoneLabel(milestoneIndex);
  }

  async submitCreateProject(): Promise<void> {
    const managerKey = this.selectedManagerKey();
    const developerKeys = this.selectedDeveloperKeys();
    if (!managerKey) {
      this.createProjectError.set('Select a project manager.');
      return;
    }
    if (!developerKeys.length) {
      this.createProjectError.set('Select at least one developer team member.');
      return;
    }
    if (!this.isCreateFormValid()) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.createProjectSaving.set(true);
    this.createProjectError.set('');

    const value = this.createForm.getRawValue();
    try {
      const payload = {
          clientName: value.clientName.trim(),
          company: this.optionalText(value.company),
          email: this.optionalText(value.email),
          phone: this.optionalText(value.phone),
          address: this.optionalText(value.address),
          notes: this.optionalText(value.notes),
          name: value.projectName.trim(),
          contract: {
            projectName: value.projectName.trim(),
            projectType: value.projectType.trim(),
            signedAt: value.signedAt || undefined,
            remarks: this.optionalText(value.contractRemarks),
            modules: this.modulesForm.controls.map((control) => ({
              name: String(control.get('name')?.value ?? '').trim(),
              description: this.optionalText(control.get('description')?.value),
              features: this.optionalText(control.get('features')?.value),
              processFlow: this.optionalText(control.get('processFlow')?.value),
            })),
            milestones: this.milestonesForm.controls.map((control) => ({
              title: String(control.get('title')?.value ?? '').trim(),
              description: this.optionalText(control.get('description')?.value),
              dueDate: this.optionalText(control.get('dueDate')?.value),
              connectedModuleId: this.optionalText(control.get('connectedModuleId')?.value),
            })),
            paymentSchedule: this.paymentScheduleForm.controls.map((control) => ({
              label: String(control.get('label')?.value ?? '').trim(),
              amount: Number(control.get('amount')?.value),
              description: this.optionalText(control.get('description')?.value),
              dueDate: this.optionalText(control.get('dueDate')?.value),
              notes: this.optionalText(control.get('notes')?.value),
              connectedMilestoneId: this.optionalText(control.get('connectedMilestoneId')?.value),
            })),
          },
          projectManager: this.parseUserKey(managerKey),
          teamMembers: developerKeys.map((key) => this.parseUserKey(key)),
      };
      const id = this.projectId();
      const response = id
        ? await firstValueFrom(this.adminApi.updateProject(id, payload))
        : await firstValueFrom(this.adminApi.createProject(payload));
      await this.router.navigate(['/admin/projects', response.data.id]);
    } catch (err: unknown) {
      const message =
        typeof err === 'object'
        && err !== null
        && 'error' in err
        && typeof (err as { error?: { message?: string } }).error?.message === 'string'
          ? (err as { error: { message: string } }).error.message
          : `Unable to ${this.isUpdateMode() ? 'update' : 'create'} project.`;
      this.createProjectError.set(message);
    } finally {
      this.createProjectSaving.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.listProjects());
      this.projects.set(response.data.items);
    } catch {
      this.error.set('Unable to load projects.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadProjectForm(): Promise<void> {
    this.createProjectLoading.set(true);
    this.createProjectError.set('');
    this.selectedManagerKey.set('');
    this.managerSearch.set('');
    this.selectedDeveloperKeys.set([]);
    this.developerSearch.set('');
    this.resetCreateForm();

    try {
      const id = this.projectId();
      const [assigneesResponse, projectResponse] = await Promise.all([
        firstValueFrom(this.adminApi.listProjectAssignees()),
        id ? firstValueFrom(this.adminApi.getProject(id)) : Promise.resolve(null),
      ]);

      this.managers.set(assigneesResponse.data);
      this.developers.set(assigneesResponse.data);

      if (projectResponse) {
        const project = projectResponse.data;
        const contract = project.contract;
        this.createForm.patchValue({
          clientName: project.clientName,
          company: project.company ?? '',
          email: project.email ?? '',
          phone: project.phone ?? '',
          address: project.address ?? '',
          notes: project.notes ?? '',
          projectName: contract?.projectName ?? project.name,
          projectType: contract?.projectType ?? project.projectType ?? '',
          signedAt: contract?.signedAt ?? '',
          contractRemarks: contract?.remarks ?? '',
        });

        this.modulesForm.clear();
        this.milestonesForm.clear();
        this.paymentScheduleForm.clear();
        for (const module of contract?.modules ?? []) {
          this.modulesForm.push(this.createModuleGroup(module));
        }
        for (const milestone of contract?.milestones ?? []) {
          this.milestonesForm.push(this.createMilestoneGroup(milestone));
        }
        for (const payment of contract?.paymentSchedule ?? []) {
          this.paymentScheduleForm.push(this.createPaymentScheduleGroup(payment));
        }
        if (!this.modulesForm.length) this.modulesForm.push(this.createModuleGroup());
        if (!this.milestonesForm.length) this.milestonesForm.push(this.createMilestoneGroup());
        if (!this.paymentScheduleForm.length) this.paymentScheduleForm.push(this.createPaymentScheduleGroup());

        this.selectedManagerKey.set(
          project.projectManager ? this.userKey(project.projectManager) : '',
        );
        this.selectedDeveloperKeys.set(project.teamMembers.map((member) => this.userKey(member)));
      }
    } catch (err: unknown) {
      const message =
        typeof err === 'object'
        && err !== null
        && 'error' in err
        && typeof (err as { error?: { message?: string } }).error?.message === 'string'
          ? (err as { error: { message: string } }).error.message
          : 'Unable to load project form.';
      this.createProjectError.set(message);
    } finally {
      this.createProjectLoading.set(false);
    }
  }

  private createModuleGroup(value?: {
    name?: string;
    description?: string | null;
    features?: string | null;
    processFlow?: string | null;
  }) {
    return this.formBuilder.group({
      name: [value?.name ?? ''],
      description: [value?.description ?? ''],
      features: [value?.features ?? ''],
      processFlow: [value?.processFlow ?? ''],
    });
  }

  private createMilestoneGroup(value?: {
    title?: string;
    description?: string | null;
    dueDate?: string | null;
    connectedModuleId?: string | null;
  }) {
    return this.formBuilder.group({
      title: [value?.title ?? ''],
      description: [value?.description ?? ''],
      dueDate: [value?.dueDate ?? ''],
      connectedModuleId: [value?.connectedModuleId ?? ''],
    });
  }

  private createPaymentScheduleGroup(value?: {
    label?: string;
    description?: string | null;
    amount?: number | null;
    dueDate?: string | null;
    notes?: string | null;
    connectedMilestoneId?: string | null;
  }) {
    return this.formBuilder.group({
      label: [value?.label ?? ''],
      description: [value?.description ?? ''],
      amount: [value?.amount != null ? String(value.amount) : ''],
      dueDate: [value?.dueDate ?? ''],
      notes: [value?.notes ?? ''],
      connectedMilestoneId: [value?.connectedMilestoneId ?? ''],
    });
  }

  private isCreateFormValid(): boolean {
    const value = this.createForm.getRawValue();

    if (!value.clientName.trim()) {
      this.createProjectError.set('Client name is required.');
      return false;
    }

    if (!value.projectName.trim() || !value.projectType.trim()) {
      this.createProjectError.set('Project name and project type are required.');
      return false;
    }

    if (!value.signedAt) {
      this.createProjectError.set('Signed date is required.');
      return false;
    }

    if (
      this.modulesForm.length === 0
      || this.milestonesForm.length === 0
      || this.paymentScheduleForm.length === 0
    ) {
      this.createProjectError.set('Add at least one module, milestone, and payment schedule item.');
      return false;
    }

    for (const control of this.modulesForm.controls) {
      const name = String(control.get('name')?.value ?? '').trim();
      if (!name) {
        this.createProjectError.set('Each module needs a name.');
        return false;
      }
    }

    for (const control of this.milestonesForm.controls) {
      const title = String(control.get('title')?.value ?? '').trim();
      if (!title) {
        this.createProjectError.set('Each milestone needs a title.');
        return false;
      }
    }

    for (const control of this.paymentScheduleForm.controls) {
      const label = String(control.get('label')?.value ?? '').trim();
      const amount = this.parseOptionalNumber(control.get('amount')?.value);
      if (!label || amount === null || amount < 0) {
        this.createProjectError.set('Each payment schedule row needs a label and amount.');
        return false;
      }
    }

    this.createProjectError.set('');
    return true;
  }

  private parseLinkedIndexes(value: unknown): number[] {
    if (value === null || value === undefined || value === '') {
      return [];
    }

    return String(value)
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((part) => Number.isInteger(part) && part >= 0);
  }

  private linkedModuleIndexesByOtherMilestones(currentMilestoneIndex: number): Set<number> {
    const used = new Set<number>();

    this.milestonesForm.controls.forEach((control, index) => {
      if (index === currentMilestoneIndex) {
        return;
      }

      this.parseLinkedIndexes(control.get('connectedModuleId')?.value).forEach((moduleIndex) => {
        used.add(moduleIndex);
      });
    });

    return used;
  }

  private reindexMilestoneModuleLinks(removedModuleIndex: number): void {
    for (const control of this.milestonesForm.controls) {
      const linked = this.parseLinkedIndexes(control.get('connectedModuleId')?.value)
        .filter((id) => id !== removedModuleIndex)
        .map((id) => (id > removedModuleIndex ? id - 1 : id));
      control.get('connectedModuleId')?.setValue(linked.join(','));
    }
  }

  private reindexPaymentMilestoneLinks(removedMilestoneIndex: number): void {
    for (const control of this.paymentScheduleForm.controls) {
      const linked = control.get('connectedMilestoneId')?.value;
      if (linked === '' || linked === null || linked === undefined) {
        continue;
      }

      const index = Number(linked);
      if (!Number.isInteger(index)) {
        continue;
      }

      if (index === removedMilestoneIndex) {
        control.get('connectedMilestoneId')?.setValue('');
      } else if (index > removedMilestoneIndex) {
        control.get('connectedMilestoneId')?.setValue(String(index - 1));
      }
    }
  }

  private resetCreateForm(): void {
    this.createForm.patchValue({
      clientName: '',
      company: '',
      email: '',
      phone: '',
      address: '',
      notes: '',
      projectName: '',
      projectType: '',
      signedAt: this.todayIsoDate(),
      contractRemarks: '',
    });

    this.modulesForm.clear();
    this.milestonesForm.clear();
    this.paymentScheduleForm.clear();

    this.modulesForm.push(this.createModuleGroup());
    this.milestonesForm.push(this.createMilestoneGroup());
    this.paymentScheduleForm.push(this.createPaymentScheduleGroup());
    this.activeModuleTab.set(0);
    this.activeMilestoneTab.set(0);
    this.activePaymentTab.set(0);
  }

  private todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private parseOptionalNumber(value: unknown): number | null {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private optionalText(value: unknown): string | undefined {
    const text = String(value ?? '').trim();
    return text ? text : undefined;
  }

  private parseUserKey(key: string): { id: number; source: 'pcmazing_admin_users' | 'tblusers' } {
    const [source, idRaw] = key.split(':');
    return {
      source: source as 'pcmazing_admin_users' | 'tblusers',
      id: Number(idRaw),
    };
  }
}
