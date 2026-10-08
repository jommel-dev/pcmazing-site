export type PermissionKey = string;

export type PermissionGroup = {
  id: string;
  label: string;
  permissions: { key: PermissionKey; label: string }[];
};

function crud(
  area: string,
  label: string,
  actions: Array<'view' | 'create' | 'edit' | 'delete'> = ['view', 'create', 'edit', 'delete'],
): PermissionGroup {
  const labels: Record<string, string> = {
    view: `View ${label}`,
    create: `Create ${label}`,
    edit: `Edit ${label}`,
    delete: `Delete ${label}`,
  };
  return {
    id: area,
    label,
    permissions: actions.map((action) => ({
      key: `${area}.${action}`,
      label: labels[action],
    })),
  };
}

function viewOnly(area: string, label: string): PermissionGroup {
  return crud(area, label, ['view']);
}

/** Curated fine-grained permissions. Areas align to AdminModuleKey where possible. */
export const PERMISSION_CATALOG: PermissionGroup[] = [
  viewOnly('dashboard', 'Organization Dashboard'),
  viewOnly('marketing_dashboard', 'Marketing Dashboard'),
  viewOnly('sales_dashboard', 'Sales Dashboard'),
  viewOnly('developers_dashboard', 'Developers Dashboard'),
  crud('contact_inquiries', 'Customer Inquiries', ['view', 'edit']),
  crud('customer_reviews', 'Customer Reviews', ['view', 'edit']),
  crud('demo_requests', 'Scheduled Demos', ['view', 'edit']),
  crud('sales_order', 'Sales Orders'),
  crud('job_order', 'Job Orders'),
  crud('quotation', 'Quotations'),
  crud('local_price_lists', 'Local Price Lists'),
  crud('inventory', 'Inventory'),
  crud('customers', 'Customers & Dealers', ['view', 'create', 'edit']),
  {
    id: 'company_expenses',
    label: 'Company Expenses',
    permissions: [
      { key: 'company_expenses.view', label: 'View company expenses' },
      { key: 'company_expenses.create', label: 'Create company expenses' },
      { key: 'company_expenses.edit', label: 'Edit company expenses' },
      { key: 'company_expenses.delete', label: 'Delete company expenses' },
    ],
  },
  crud('lead_generation', 'Lead Generation', ['view', 'create', 'edit']),
  viewOnly('organization_team', 'Organization Team'),
  crud('projects', 'Projects', ['view', 'create', 'edit']),
  viewOnly('kanban', 'Kanban'),
  viewOnly('developers_team', 'Developers Team'),
  {
    id: 'payroll',
    label: 'Payroll',
    permissions: [
      { key: 'payroll.view', label: 'View payroll' },
      { key: 'payroll.edit', label: 'Edit payroll settings' },
      { key: 'payroll.run', label: 'Run payroll' },
    ],
  },
  viewOnly('accounting', 'Accounting'),
  {
    id: 'user_management',
    label: 'User Management',
    permissions: [
      { key: 'user_management.view', label: 'View users' },
      { key: 'user_management.create', label: 'Create users' },
      { key: 'user_management.edit', label: 'Edit users' },
      { key: 'user_management.deactivate', label: 'Deactivate users' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    permissions: [
      { key: 'settings.view', label: 'View settings' },
      { key: 'settings.roles.manage', label: 'Manage roles and permissions' },
    ],
  },
  {
    id: 'printing_generator',
    label: 'Printing Generator',
    permissions: [
      { key: 'printing_generator.view', label: 'View printing generator' },
      { key: 'printing_generator.templates.edit', label: 'Edit printing templates' },
    ],
  },
  viewOnly('profile', 'Profile'),
  viewOnly('time_clock', 'Time Clock'),
];

export function allPermissionKeys(): string[] {
  const keys: string[] = [];
  for (const group of PERMISSION_CATALOG) {
    for (const permission of group.permissions) {
      keys.push(permission.key);
    }
  }
  return keys;
}
