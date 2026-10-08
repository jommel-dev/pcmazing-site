-- 073_settings_rbac_roles.sql
-- DB-backed roles + fine-grained permissions for Settings RBAC.

CREATE TABLE IF NOT EXISTS pcmazing_roles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pcmazing_roles_slug_alive
  ON pcmazing_roles (slug)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS pcmazing_role_permissions (
  role_id BIGINT NOT NULL REFERENCES pcmazing_roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_role_permissions_key
  ON pcmazing_role_permissions (permission_key);

ALTER TABLE pcmazing_admin_users
  ADD COLUMN IF NOT EXISTS role_id BIGINT NULL REFERENCES pcmazing_roles(id);

-- Seed roles (idempotent by slug among non-deleted rows)
INSERT INTO pcmazing_roles (name, slug, is_system, is_active)
SELECT v.name, v.slug, v.is_system, TRUE
FROM (
  VALUES
    ('Super Admin', 'super_admin', TRUE),
    ('Admin', 'admin', FALSE),
    ('Manager', 'manager', FALSE),
    ('Assistant Manager', 'assistant_manager', FALSE),
    ('Marketing Lead', 'marketing_lead', FALSE),
    ('Marketing', 'marketing', FALSE),
    ('Sales Manager', 'sales_manager', FALSE),
    ('Assistant Sales Manager', 'assistant_sales_manager', FALSE),
    ('Developer', 'developer', FALSE),
    ('Project Manager', 'project_manager', FALSE)
) AS v(name, slug, is_system)
WHERE NOT EXISTS (
  SELECT 1 FROM pcmazing_roles r
  WHERE r.slug = v.slug AND r.deleted_at IS NULL
);

-- Grant helper: insert missing permission keys for a role slug
CREATE OR REPLACE FUNCTION _pcmazing_grant_role_perms(p_slug TEXT, p_keys TEXT[])
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  rid BIGINT;
BEGIN
  SELECT id INTO rid FROM pcmazing_roles WHERE slug = p_slug AND deleted_at IS NULL LIMIT 1;
  IF rid IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO pcmazing_role_permissions (role_id, permission_key)
  SELECT rid, k
  FROM unnest(p_keys) AS k
  ON CONFLICT DO NOTHING;
END;
$$;

-- Admin: Settings + Printing + User Management + Payroll (+ profile)
SELECT _pcmazing_grant_role_perms(
  'admin',
  ARRAY[
    'profile.view',
    'settings.view',
    'settings.roles.manage',
    'printing_generator.view',
    'printing_generator.templates.edit',
    'user_management.view',
    'user_management.create',
    'user_management.edit',
    'user_management.deactivate',
    'payroll.view',
    'payroll.edit',
    'payroll.run'
  ]
);

-- Ops / sales roles (match getAllowedModuleKeys + expense/dashboard API keys)
SELECT _pcmazing_grant_role_perms(
  slug,
  ARRAY[
    'sales_dashboard.view',
    'contact_inquiries.view',
    'contact_inquiries.edit',
    'customer_reviews.view',
    'customer_reviews.edit',
    'sales_order.view',
    'sales_order.create',
    'sales_order.edit',
    'sales_order.delete',
    'job_order.view',
    'job_order.create',
    'job_order.edit',
    'job_order.delete',
    'quotation.view',
    'quotation.create',
    'quotation.edit',
    'quotation.delete',
    'local_price_lists.view',
    'local_price_lists.create',
    'local_price_lists.edit',
    'local_price_lists.delete',
    'inventory.view',
    'inventory.create',
    'inventory.edit',
    'inventory.delete',
    'company_expenses.view',
    'company_expenses.create',
    'company_expenses.edit',
    'company_expenses.delete',
    'profile.view',
    'time_clock.view'
  ]
)
FROM unnest(ARRAY[
  'manager',
  'assistant_manager',
  'sales_manager',
  'assistant_sales_manager'
]) AS slug;

SELECT _pcmazing_grant_role_perms(
  'marketing_lead',
  ARRAY[
    'marketing_dashboard.view',
    'lead_generation.view',
    'lead_generation.create',
    'lead_generation.edit',
    'organization_team.view',
    'profile.view',
    'time_clock.view'
  ]
);

SELECT _pcmazing_grant_role_perms(
  'marketing',
  ARRAY[
    'marketing_dashboard.view',
    'lead_generation.view',
    'lead_generation.create',
    'lead_generation.edit',
    'profile.view',
    'time_clock.view'
  ]
);

SELECT _pcmazing_grant_role_perms(
  slug,
  ARRAY[
    'developers_dashboard.view',
    'projects.view',
    'projects.create',
    'projects.edit',
    'kanban.view',
    'profile.view',
    'time_clock.view'
  ]
)
FROM unnest(ARRAY['developer', 'project_manager']) AS slug;

-- Super Admin: optional full catalog not required (runtime '*'); keep profile for clarity
SELECT _pcmazing_grant_role_perms('super_admin', ARRAY['profile.view']);

DROP FUNCTION IF EXISTS _pcmazing_grant_role_perms(TEXT, TEXT[]);

-- Backfill role_id from existing role display strings
UPDATE pcmazing_admin_users u
SET role_id = r.id
FROM pcmazing_roles r
WHERE u.role_id IS NULL
  AND r.deleted_at IS NULL
  AND lower(regexp_replace(trim(u.role), '[\s_-]+', '', 'g'))
    = lower(regexp_replace(trim(r.name), '[\s_-]+', '', 'g'));
