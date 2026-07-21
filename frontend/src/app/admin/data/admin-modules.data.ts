export interface AdminModuleItem {
  key: string;
  label: string;
  route: string;
  description: string;
  status: 'active' | 'coming_soon';
  referenceMenu?: string;
}

/** Module map aligned with 3BMA internal system flow (reference only). */
export const ADMIN_MODULES: AdminModuleItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    route: '/admin/dashboard',
    description: 'Overview KPIs, sales summary, and operations control.',
    status: 'active',
    referenceMenu: 'dashboard',
  },
  {
    key: 'contact_inquiries',
    label: 'Customer Contact Us',
    route: '/admin/contact-inquiries',
    description: 'Website contact form submissions and follow-up status.',
    status: 'active',
  },
  {
    key: 'customer_reviews',
    label: 'Customer Reviews',
    route: '/admin/customer-reviews',
    description: 'Review and approve customer feedback before publishing on the website.',
    status: 'active',
  },
  {
    key: 'demo_requests',
    label: 'Schedule A Demo',
    route: '/admin/demo-requests',
    description: 'Demo booking requests with follow-up and confirmation status.',
    status: 'active',
  },
  {
    key: 'sales_order_materials',
    label: 'Material Sales Order',
    route: '/admin/modules/sales-order-materials',
    description: 'Material sales orders, fulfillment, and billing workflow.',
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
    key: 'purchase_order_materials',
    label: 'Materials PO',
    route: '/admin/modules/purchase-order-materials',
    description: 'Purchase orders for materials and supplier tracking.',
    status: 'coming_soon',
    referenceMenu: 'purchase_order_materials',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    route: '/admin/inventory',
    description: 'Stock levels, item master, and warehouse movement.',
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
    key: 'user_management',
    label: 'User Management',
    route: '/admin/modules/user-management',
    description: 'Internal users, roles, and permission assignments.',
    status: 'coming_soon',
    referenceMenu: 'user_management',
  },
  {
    key: 'settings',
    label: 'Settings',
    route: '/admin/modules/settings',
    description: 'Business profile, branches, print settings, RBAC, and audit logs.',
    status: 'coming_soon',
    referenceMenu: 'settings',
  },
];

export const ADMIN_NAV_MODULES = ADMIN_MODULES.filter((item) => item.key !== 'dashboard');
