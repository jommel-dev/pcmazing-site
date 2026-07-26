export interface AdminModuleItem {
  key: string;
  label: string;
  route: string;
  description: string;
  status: 'active' | 'coming_soon';
  referenceMenu?: string;
}

export interface AdminNavGroup {
  key: string;
  label: string;
  items: AdminModuleItem[];
}

export interface AdminNavSection {
  key: string;
  title: string;
  items: AdminModuleItem[];
  groups?: AdminNavGroup[];
}

/** Flat module registry used by routes and placeholder pages. */
export const ADMIN_MODULES: AdminModuleItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    route: '/admin/dashboard',
    description:
      'Organization dashboards for Computer Hardware & Repair, System Development, Project Management, and Marketing.',
    status: 'active',
    referenceMenu: 'dashboard',
  },
  {
    key: 'contact_inquiries',
    label: 'Customer Inquiries',
    route: '/admin/contact-inquiries',
    description: 'Website contact form submissions and follow-up status.',
    status: 'active',
  },
  {
    key: 'customer_reviews',
    label: 'Customer Review',
    route: '/admin/customer-reviews',
    description: 'Review and approve customer feedback before publishing on the website.',
    status: 'active',
  },
  {
    key: 'demo_requests',
    label: 'Scheduled Demo',
    route: '/admin/demo-requests',
    description: 'Demo booking requests with follow-up and confirmation status.',
    status: 'active',
  },
  {
    key: 'job_order',
    label: 'Job Order',
    route: '/admin/modules/job-order',
    description: 'Sales order flow, fulfillment, and job tracking.',
    status: 'coming_soon',
    referenceMenu: 'sales_order_materials',
  },
  {
    key: 'quotation',
    label: 'Quotation',
    route: '/admin/quotations',
    description: 'Create and manage customer quotations.',
    status: 'active',
    referenceMenu: 'quotation',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    route: '/admin/inventory',
    description: 'Material stock levels, purchase orders, and warehouse movement.',
    status: 'active',
    referenceMenu: 'inventory',
  },
  {
    key: 'customers',
    label: 'Customers & Dealers',
    route: '/admin/modules/customers',
    description: 'Customer records, dealers, and stakeholder management.',
    status: 'coming_soon',
    referenceMenu: 'customers',
  },
  {
    key: 'lead_generation',
    label: 'Lead Generation',
    route: '/admin/lead-generation',
    description: 'Capture, qualify, and track marketing leads.',
    status: 'active',
  },
  {
    key: 'organization_team',
    label: 'Organization & Team',
    route: '/admin/organization-team',
    description: 'Marketing teams, branches, and organizational structure.',
    status: 'active',
  },
  {
    key: 'projects',
    label: 'Projects',
    route: '/admin/modules/projects',
    description: 'Software and system development project pipeline.',
    status: 'coming_soon',
  },
  {
    key: 'developers_team',
    label: 'Developers & Team',
    route: '/admin/modules/developers-team',
    description: 'Developer roster, assignments, and delivery capacity.',
    status: 'coming_soon',
  },
  {
    key: 'payroll',
    label: 'Payroll',
    route: '/admin/modules/payroll',
    description: 'Employee payroll processing and payslip management.',
    status: 'coming_soon',
  },
  {
    key: 'accounting',
    label: 'Accounting',
    route: '/admin/modules/accounting',
    description: 'Financial records, receivables, and accounting workflows.',
    status: 'coming_soon',
  },
  {
    key: 'user_management',
    label: 'User Management',
    route: '/admin/users',
    description: 'Internal users, roles, and permission assignments.',
    status: 'active',
    referenceMenu: 'user_management',
  },
  {
    key: 'settings',
    label: 'Settings',
    route: '/admin/modules/settings',
    description: 'Business profile, branches, RBAC, and system configuration.',
    status: 'coming_soon',
    referenceMenu: 'settings',
  },
  {
    key: 'printing_generator',
    label: 'Printing Generator',
    route: '/admin/modules/printing-generator',
    description: 'Design printable documents with pdf-lib and dynamic field mapping.',
    status: 'coming_soon',
  },
];

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    key: 'website',
    title: 'Website',
    items: ADMIN_MODULES.filter((item) =>
      ['contact_inquiries', 'customer_reviews', 'demo_requests'].includes(item.key),
    ),
  },
  {
    key: 'sales_operations',
    title: 'Sales Operations',
    items: ADMIN_MODULES.filter((item) =>
      ['job_order', 'quotation', 'inventory', 'customers'].includes(item.key),
    ),
  },
  {
    key: 'marketing',
    title: 'Marketing',
    items: ADMIN_MODULES.filter((item) => ['lead_generation', 'organization_team'].includes(item.key)),
  },
  {
    key: 'system_development',
    title: 'System Development',
    items: ADMIN_MODULES.filter((item) => ['projects', 'developers_team'].includes(item.key)),
  },
  {
    key: 'system_management',
    title: 'System Management',
    items: ADMIN_MODULES.filter((item) =>
      ['payroll', 'accounting', 'user_management', 'settings', 'printing_generator'].includes(item.key),
    ),
  },
];
