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
    key: 'marketing_dashboard',
    label: 'Marketing Dashboard',
    route: '/admin/marketing-dashboard',
    description: 'Marketing overview and shortcuts for lead generation.',
    status: 'active',
  },
  {
    key: 'sales_dashboard',
    label: 'Sales Dashboard',
    route: '/admin/sales-dashboard',
    description: 'Sales overview for inquiries, reviews, and operations.',
    status: 'active',
  },
  {
    key: 'developers_dashboard',
    label: 'Developers Dashboard',
    route: '/admin/developers-dashboard',
    description: 'Assigned projects and task boards for developers and project managers.',
    status: 'active',
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
    key: 'sales_order',
    label: 'Sales Order',
    route: '/admin/sales-order',
    description: 'Record item sales and automatically adjust inventory stock.',
    status: 'active',
    referenceMenu: 'sales_order_materials',
  },
  {
    key: 'job_order',
    label: 'Job Order',
    route: '/admin/job-order',
    description: 'Service job orders, assigned staff, parts used, and status tracking.',
    status: 'active',
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
    route: '/admin/projects',
    description: 'Software and system development project pipeline.',
    status: 'active',
  },
  {
    key: 'kanban',
    label: 'Kanban',
    route: '/admin/kanban',
    description: 'Open task boards for projects assigned to you.',
    status: 'active',
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
    route: '/admin/payroll',
    description: 'Employee payroll processing and payslip management.',
    status: 'active',
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
    description: 'Design printable documents with dynamic, draggable receipt templates.',
    status: 'active',
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
      ['sales_order', 'job_order', 'quotation', 'inventory', 'customers'].includes(item.key),
    ),
  },
  {
    key: 'marketing',
    title: 'Marketing',
    items: ADMIN_MODULES.filter((item) =>
      ['marketing_dashboard', 'lead_generation', 'organization_team'].includes(item.key),
    ),
  },
  {
    key: 'system_development',
    title: 'System Development',
    items: ADMIN_MODULES.filter((item) =>
      ['developers_dashboard', 'projects', 'kanban', 'developers_team'].includes(item.key),
    ),
  },
  {
    key: 'sales_home',
    title: 'Sales',
    items: ADMIN_MODULES.filter((item) => item.key === 'sales_dashboard'),
  },
  {
    key: 'system_management',
    title: 'System Management',
    items: ADMIN_MODULES.filter((item) =>
      ['payroll', 'accounting', 'user_management', 'settings', 'printing_generator'].includes(
        item.key,
      ),
    ),
  },
];

export function filterNavSectionsForRole(
  role: string | null | undefined,
  allowed: Set<string> | 'all',
): AdminNavSection[] {
  const sections: AdminNavSection[] = [];

  // Super admin keeps classic top dashboard link via layout; sections as today.
  if (allowed === 'all') {
    return [
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
          ['sales_order', 'job_order', 'quotation', 'inventory', 'customers'].includes(item.key),
        ),
      },
      {
        key: 'marketing',
        title: 'Marketing',
        items: ADMIN_MODULES.filter((item) =>
          ['lead_generation', 'organization_team'].includes(item.key),
        ),
      },
      {
        key: 'system_development',
        title: 'System Development',
        items: ADMIN_MODULES.filter((item) =>
          ['projects', 'developers_team'].includes(item.key),
        ),
      },
      {
        key: 'system_management',
        title: 'System Management',
        items: ADMIN_MODULES.filter((item) =>
          ['payroll', 'accounting', 'user_management', 'settings', 'printing_generator'].includes(
            item.key,
          ),
        ),
      },
    ];
  }

  const marketingItems = ADMIN_MODULES.filter(
    (item) =>
      ['marketing_dashboard', 'lead_generation', 'organization_team'].includes(item.key) &&
      allowed.has(item.key),
  ).map((item) =>
    item.key === 'projects'
      ? item
      : item,
  );
  if (marketingItems.length) {
    sections.push({ key: 'marketing', title: 'Marketing', items: marketingItems });
  }

  const salesHome = ADMIN_MODULES.filter(
    (item) => item.key === 'sales_dashboard' && allowed.has(item.key),
  );
  const salesWebsite = ADMIN_MODULES.filter(
    (item) =>
      ['contact_inquiries', 'customer_reviews'].includes(item.key) && allowed.has(item.key),
  );
  const salesOps = ADMIN_MODULES.filter(
    (item) =>
      ['sales_order', 'job_order', 'quotation', 'inventory'].includes(item.key) && allowed.has(item.key),
  );
  if (salesHome.length) {
    sections.push({ key: 'sales_home', title: 'Sales', items: salesHome });
  }
  if (salesWebsite.length) {
    sections.push({ key: 'website', title: 'Website', items: salesWebsite });
  }
  if (salesOps.length) {
    sections.push({ key: 'sales_operations', title: 'Sales Operations', items: salesOps });
  }

  const devItems = ADMIN_MODULES.filter(
    (item) =>
      ['developers_dashboard', 'projects', 'kanban'].includes(item.key) && allowed.has(item.key),
  ).map((item) =>
    item.key === 'projects' ? { ...item, label: 'My Projects' } : item,
  );
  if (devItems.length) {
    sections.push({ key: 'system_development', title: 'System Development', items: devItems });
  }

  return sections;
}
