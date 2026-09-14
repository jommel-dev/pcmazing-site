-- PCmazing initial schema for a blank PostgreSQL database.
-- Replaces the incremental 001–066 migration chain.
--
-- Included: website CRM, admin users, marketing/deals/contracts, projects,
-- payroll/ESS, inventory (tblmaterials + brands/types), purchases, job orders,
-- sales orders, quotations, printing, and company expenses.
--
-- Omitted (legacy 3BMA / unused): tblusers, tblrbac, tblquotation,
-- tblquotation_items, tbltransaction_parts_items, tbltransaction_product_items,
-- and views systems / modules / milestones / payment_schedules.

-- =============================================================================
-- Inventory (still used by materials, job orders, sales, quotations, purchases)
-- =============================================================================

CREATE TABLE IF NOT EXISTS tblproducttypes (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tblproducttypes_name
  ON tblproducttypes (LOWER(TRIM(name)));

CREATE TABLE IF NOT EXISTS tblbrands (
  id BIGSERIAL PRIMARY KEY,
  "brandName" VARCHAR(150) NOT NULL,
  product_type_id BIGINT REFERENCES tblproducttypes(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'ACU'
);

CREATE INDEX IF NOT EXISTS idx_tblbrands_name
  ON tblbrands (LOWER(TRIM("brandName")));

CREATE TABLE IF NOT EXISTS tblmaterials (
  id BIGSERIAL PRIMARY KEY,
  material_name VARCHAR(255) NOT NULL,
  material_code VARCHAR(100),
  description TEXT,
  brand_id BIGINT REFERENCES tblbrands(id) ON DELETE SET NULL,
  product_type_id BIGINT REFERENCES tblproducttypes(id) ON DELETE SET NULL,
  unit VARCHAR(50) NOT NULL DEFAULT 'PCS',
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  order_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sell_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  on_hand_stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reorder_level NUMERIC(12, 2) NOT NULL DEFAULT 0,
  image_url VARCHAR(500),
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tblmaterials_name
  ON tblmaterials (material_name)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tblmaterials_code
  ON tblmaterials (LOWER(TRIM(material_code)))
  WHERE deleted_at IS NULL AND material_code IS NOT NULL AND TRIM(material_code) <> '';

COMMENT ON COLUMN tblmaterials.order_cost IS
  'Supplier/order cost used for inventory valuation and margin.';

COMMENT ON COLUMN tblmaterials.image_url IS
  'Public URL path to the material product image.';

-- =============================================================================
-- Purchases
-- =============================================================================

CREATE TABLE IF NOT EXISTS tblvendors (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tblvendors_name
  ON tblvendors (LOWER(TRIM(name)));

CREATE TABLE IF NOT EXISTS tblpurchase_orders (
  id BIGSERIAL PRIMARY KEY,
  po_number VARCHAR(80),
  vendor_id BIGINT REFERENCES tblvendors(id) ON DELETE RESTRICT,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'for_approval',
  po_type VARCHAR(20) NOT NULL DEFAULT 'ACM',
  branch_id BIGINT,
  remarks TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tblpurchase_orders_created
  ON tblpurchase_orders (id DESC);

CREATE TABLE IF NOT EXISTS tbltransaction_material_items (
  id BIGSERIAL PRIMARY KEY,
  trans_type VARCHAR(40) NOT NULL DEFAULT 'purchase',
  material_id BIGINT NOT NULL REFERENCES tblmaterials(id),
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  purchase_id BIGINT NOT NULL REFERENCES tblpurchase_orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tbltransaction_material_items_purchase
  ON tbltransaction_material_items (purchase_id, id);

CREATE TABLE IF NOT EXISTS tblpo_payments (
  id BIGSERIAL PRIMARY KEY,
  po_id BIGINT NOT NULL REFERENCES tblpurchase_orders(id) ON DELETE CASCADE,
  method VARCHAR(40) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tblpo_payments_po
  ON tblpo_payments (po_id, id);

-- =============================================================================
-- Website CRM
-- =============================================================================

CREATE TABLE IF NOT EXISTS contact_inquiries (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  service_interest VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_created_at
  ON contact_inquiries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status
  ON contact_inquiries (status);

CREATE TABLE IF NOT EXISTS customer_reviews (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255),
  company VARCHAR(150),
  rating NUMERIC(2, 1) NOT NULL DEFAULT 5,
  title VARCHAR(200),
  message TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_reviews_rating_check
    CHECK (
      rating >= 0.5
      AND rating <= 5
      AND (rating * 2) = floor(rating * 2)
    )
);

CREATE INDEX IF NOT EXISTS idx_customer_reviews_status ON customer_reviews (status);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_published
  ON customer_reviews (is_published, created_at DESC);

CREATE TABLE IF NOT EXISTS demo_requests (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  company VARCHAR(150),
  service_interest VARCHAR(120),
  preferred_date DATE,
  preferred_time VARCHAR(50),
  message TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  follow_up_notes TEXT,
  followed_up_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_requests_status ON demo_requests (status);
CREATE INDEX IF NOT EXISTS idx_demo_requests_created_at ON demo_requests (created_at DESC);

-- =============================================================================
-- Admin users (primary user store when tblusers is not imported)
-- =============================================================================

CREATE TABLE IF NOT EXISTS pcmazing_admin_users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(255),
  full_name VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  profile_image_url VARCHAR(500),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_admin_users_username
  ON pcmazing_admin_users (username);

INSERT INTO pcmazing_admin_users (username, full_name, password_hash, role)
VALUES (
  'admin',
  'System Administrator',
  'f865b53623b121fd34ee5426c792e5c33af8c227',
  'admin'
)
ON CONFLICT (username) DO NOTHING;

-- =============================================================================
-- Marketing / leads
-- =============================================================================

CREATE TABLE IF NOT EXISTS pcmazing_marketing_teams (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  parent_team_id BIGINT REFERENCES pcmazing_marketing_teams(id) ON DELETE SET NULL,
  created_by_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_marketing_teams_parent
  ON pcmazing_marketing_teams (parent_team_id);

CREATE TABLE IF NOT EXISTS pcmazing_marketing_team_members (
  id BIGSERIAL PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES pcmazing_marketing_teams(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  member_role VARCHAR(30) NOT NULL DEFAULT 'member'
    CHECK (member_role IN ('lead_marketing', 'sub_marketing', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_marketing_team_members_user
  ON pcmazing_marketing_team_members (user_id);

CREATE TABLE IF NOT EXISTS pcmazing_client_prospects (
  id BIGSERIAL PRIMARY KEY,
  client_name VARCHAR(150) NOT NULL,
  company VARCHAR(150),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'available',
  source VARCHAR(30) NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'import')),
  notes TEXT,
  assigned_user_id BIGINT,
  assigned_team_id BIGINT REFERENCES pcmazing_marketing_teams(id) ON DELETE SET NULL,
  picked_up_by BIGINT,
  picked_up_at TIMESTAMPTZ,
  created_by_user_id BIGINT,
  follow_up_count INT NOT NULL DEFAULT 0,
  client_type VARCHAR(20) NOT NULL DEFAULT 'local'
    CHECK (client_type IN ('local', 'international')),
  currency CHAR(3) NOT NULL DEFAULT 'PHP',
  proposed_price_deal NUMERIC(14, 2),
  estimated_price_deal_php NUMERIC(14, 2),
  exchange_rate_used NUMERIC(18, 8),
  exchange_rate_date DATE,
  commission_percent NUMERIC(5, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pcmazing_client_prospects_status_check
    CHECK (status IN (
      'available',
      'picked_up',
      'called',
      'texted',
      'emailed',
      'met',
      'no_response',
      'meeting_set',
      'closed_won',
      'contract_under_review',
      'contract_signed',
      'closed_lost'
    )),
  CONSTRAINT pcmazing_client_prospects_commission_percent_check
    CHECK (commission_percent IS NULL OR (commission_percent >= 0 AND commission_percent <= 100))
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_prospects_status
  ON pcmazing_client_prospects (status);
CREATE INDEX IF NOT EXISTS idx_pcmazing_client_prospects_assigned_user
  ON pcmazing_client_prospects (assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_pcmazing_client_prospects_picked_up_by
  ON pcmazing_client_prospects (picked_up_by);

CREATE TABLE IF NOT EXISTS pcmazing_client_responses (
  id BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL REFERENCES pcmazing_client_prospects(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  response_type VARCHAR(30) NOT NULL DEFAULT 'call'
    CHECK (response_type IN ('call', 'email', 'sms', 'meeting', 'follow_up', 'other')),
  notes TEXT,
  outcome VARCHAR(100),
  follow_up_date DATE,
  follow_up_method VARCHAR(20),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_responses_prospect
  ON pcmazing_client_responses (prospect_id);

CREATE TABLE IF NOT EXISTS pcmazing_client_appointments (
  id BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL REFERENCES pcmazing_client_prospects(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  title VARCHAR(200) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  meeting_type VARCHAR(30) NOT NULL DEFAULT 'face_to_face'
    CHECK (meeting_type IN ('face_to_face', 'teams', 'gmeet', 'facebook', 'zoom')),
  location_or_link TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_appointments_user_time
  ON pcmazing_client_appointments (user_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_pcmazing_client_appointments_prospect
  ON pcmazing_client_appointments (prospect_id);

-- =============================================================================
-- Contracts / deal workflow
-- =============================================================================

CREATE TABLE IF NOT EXISTS pcmazing_client_contracts (
  id BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL UNIQUE REFERENCES pcmazing_client_prospects(id) ON DELETE CASCADE,
  system_name VARCHAR(150) NOT NULL,
  system_type VARCHAR(100) NOT NULL,
  signed_at DATE,
  signing_status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (signing_status IN ('draft', 'pending_signature', 'signed')),
  remarks TEXT,
  created_by_user_id BIGINT,
  updated_by_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contracts_prospect
  ON pcmazing_client_contracts (prospect_id);

CREATE TABLE IF NOT EXISTS pcmazing_client_contract_modules (
  id BIGSERIAL PRIMARY KEY,
  contract_id BIGINT NOT NULL REFERENCES pcmazing_client_contracts(id) ON DELETE CASCADE,
  prospect_id BIGINT REFERENCES pcmazing_client_prospects(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  module_name VARCHAR(150) NOT NULL,
  module_code VARCHAR(50),
  description TEXT,
  scope_of_work TEXT,
  delivery_timeline VARCHAR(200),
  responsible_team VARCHAR(150),
  features TEXT,
  process_flow TEXT,
  quantity NUMERIC(12, 2),
  amount NUMERIC(14, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contract_modules_contract
  ON pcmazing_client_contract_modules (contract_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contract_modules_prospect
  ON pcmazing_client_contract_modules (prospect_id, sort_order, id);

CREATE TABLE IF NOT EXISTS pcmazing_client_contract_milestones (
  id BIGSERIAL PRIMARY KEY,
  contract_id BIGINT NOT NULL REFERENCES pcmazing_client_contracts(id) ON DELETE CASCADE,
  prospect_id BIGINT REFERENCES pcmazing_client_prospects(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  title VARCHAR(150) NOT NULL,
  milestone_code VARCHAR(50),
  description TEXT,
  due_date DATE,
  dependencies TEXT,
  success_criteria TEXT,
  connected_module_sort_order TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contract_milestones_contract
  ON pcmazing_client_contract_milestones (contract_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contract_milestones_prospect
  ON pcmazing_client_contract_milestones (prospect_id, sort_order, id);

CREATE TABLE IF NOT EXISTS pcmazing_client_contract_payment_schedules (
  id BIGSERIAL PRIMARY KEY,
  contract_id BIGINT NOT NULL REFERENCES pcmazing_client_contracts(id) ON DELETE CASCADE,
  prospect_id BIGINT REFERENCES pcmazing_client_prospects(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  label VARCHAR(150) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  due_date DATE,
  notes TEXT,
  description TEXT,
  payment_code VARCHAR(50),
  milestone_id BIGINT REFERENCES pcmazing_client_contract_milestones(id) ON DELETE SET NULL,
  payment_method VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contract_payment_schedules_contract
  ON pcmazing_client_contract_payment_schedules (contract_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contract_payment_schedules_prospect
  ON pcmazing_client_contract_payment_schedules (prospect_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contract_payment_schedules_milestone
  ON pcmazing_client_contract_payment_schedules (milestone_id);
CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contract_payment_schedules_status
  ON pcmazing_client_contract_payment_schedules (status);

CREATE TABLE IF NOT EXISTS pcmazing_deal_systems (
  id BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL UNIQUE REFERENCES pcmazing_client_prospects(id) ON DELETE CASCADE,
  system_name VARCHAR(150) NOT NULL,
  system_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_deal_systems_prospect
  ON pcmazing_deal_systems (prospect_id);

CREATE TABLE IF NOT EXISTS pcmazing_deal_status_audit_log (
  id BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL REFERENCES pcmazing_client_prospects(id) ON DELETE CASCADE,
  previous_status VARCHAR(30) NOT NULL,
  new_status VARCHAR(30) NOT NULL,
  changed_by_user_id BIGINT,
  changed_by_process VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_deal_status_audit_prospect
  ON pcmazing_deal_status_audit_log (prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcmazing_deal_status_audit_status
  ON pcmazing_deal_status_audit_log (new_status, created_at DESC);

CREATE TABLE IF NOT EXISTS pcmazing_deal_contract_signing (
  id BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL UNIQUE REFERENCES pcmazing_client_prospects(id) ON DELETE CASCADE,
  contract_id BIGINT NOT NULL REFERENCES pcmazing_client_contracts(id) ON DELETE CASCADE,
  signing_token VARCHAR(64) NOT NULL UNIQUE,
  client_signer_name VARCHAR(200),
  client_signer_email VARCHAR(200),
  signature_verified_at TIMESTAMPTZ,
  signature_ip VARCHAR(45),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_deal_contract_signing_token
  ON pcmazing_deal_contract_signing (signing_token);
CREATE INDEX IF NOT EXISTS idx_pcmazing_deal_contract_signing_contract
  ON pcmazing_deal_contract_signing (contract_id);

-- =============================================================================
-- Projects
-- =============================================================================

CREATE TABLE IF NOT EXISTS pcmazing_projects (
  id BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL UNIQUE REFERENCES pcmazing_client_prospects(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  project_type VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  project_manager_user_id BIGINT NOT NULL,
  project_manager_user_source VARCHAR(40) NOT NULL,
  created_by_user_id BIGINT,
  current_epic_id BIGINT,
  current_phase_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pcmazing_projects_status_check
    CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled')),
  CONSTRAINT pcmazing_projects_pm_source_check
    CHECK (project_manager_user_source IN ('pcmazing_admin_users', 'tblusers'))
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_projects_status
  ON pcmazing_projects (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcmazing_projects_pm
  ON pcmazing_projects (project_manager_user_id, project_manager_user_source);

CREATE TABLE IF NOT EXISTS pcmazing_project_members (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES pcmazing_projects(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  user_source VARCHAR(40) NOT NULL,
  member_role VARCHAR(50) NOT NULL DEFAULT 'developer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pcmazing_project_members_source_check
    CHECK (user_source IN ('pcmazing_admin_users', 'tblusers')),
  CONSTRAINT pcmazing_project_members_unique
    UNIQUE (project_id, user_id, user_source)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_members_project
  ON pcmazing_project_members (project_id, id);
CREATE INDEX IF NOT EXISTS idx_pcmazing_project_members_user
  ON pcmazing_project_members (user_id, user_source);

CREATE TABLE IF NOT EXISTS pcmazing_project_phases (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES pcmazing_projects(id) ON DELETE CASCADE,
  contract_milestone_id BIGINT REFERENCES pcmazing_client_contract_milestones(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  due_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pcmazing_project_phases_status_check
    CHECK (status IN ('planned', 'active', 'completed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcmazing_project_phases_milestone
  ON pcmazing_project_phases (project_id, contract_milestone_id)
  WHERE contract_milestone_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pcmazing_project_phases_project
  ON pcmazing_project_phases (project_id, sort_order, id);

CREATE TABLE IF NOT EXISTS pcmazing_project_epics (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES pcmazing_projects(id) ON DELETE CASCADE,
  phase_id BIGINT REFERENCES pcmazing_project_phases(id) ON DELETE CASCADE,
  contract_milestone_id BIGINT REFERENCES pcmazing_client_contract_milestones(id) ON DELETE SET NULL,
  contract_module_id BIGINT REFERENCES pcmazing_client_contract_modules(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  due_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'planned',
  board_status VARCHAR(30) NOT NULL DEFAULT 'epics',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pcmazing_project_epics_status_check
    CHECK (status IN ('planned', 'active', 'completed')),
  CONSTRAINT pcmazing_project_epics_board_status_check
    CHECK (board_status = 'epics')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcmazing_project_epics_module
  ON pcmazing_project_epics (phase_id, contract_module_id)
  WHERE contract_module_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pcmazing_project_epics_project
  ON pcmazing_project_epics (project_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_pcmazing_project_epics_phase
  ON pcmazing_project_epics (phase_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_pcmazing_project_epics_board
  ON pcmazing_project_epics (phase_id, board_status, sort_order, id);

ALTER TABLE pcmazing_projects
  DROP CONSTRAINT IF EXISTS pcmazing_projects_current_epic_id_fkey;
ALTER TABLE pcmazing_projects
  ADD CONSTRAINT pcmazing_projects_current_epic_id_fkey
  FOREIGN KEY (current_epic_id) REFERENCES pcmazing_project_epics(id) ON DELETE SET NULL;

ALTER TABLE pcmazing_projects
  DROP CONSTRAINT IF EXISTS pcmazing_projects_current_phase_id_fkey;
ALTER TABLE pcmazing_projects
  ADD CONSTRAINT pcmazing_projects_current_phase_id_fkey
  FOREIGN KEY (current_phase_id) REFERENCES pcmazing_project_phases(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS pcmazing_project_tasks (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES pcmazing_projects(id) ON DELETE CASCADE,
  epic_id BIGINT REFERENCES pcmazing_project_epics(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'todo',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  sort_order INT NOT NULL DEFAULT 0,
  assignee_user_id BIGINT,
  assignee_user_source VARCHAR(40),
  due_date DATE,
  created_by_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pcmazing_project_tasks_status_check
    CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'testing', 'done')),
  CONSTRAINT pcmazing_project_tasks_priority_check
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT pcmazing_project_tasks_assignee_source_check
    CHECK (
      assignee_user_source IS NULL
      OR assignee_user_source IN ('pcmazing_admin_users', 'tblusers')
    )
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_tasks_board
  ON pcmazing_project_tasks (project_id, status, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_pcmazing_project_tasks_assignee
  ON pcmazing_project_tasks (assignee_user_id, assignee_user_source);
CREATE INDEX IF NOT EXISTS idx_pcmazing_project_tasks_epic
  ON pcmazing_project_tasks (epic_id, status, sort_order, id);

CREATE TABLE IF NOT EXISTS pcmazing_project_task_comments (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES pcmazing_project_tasks(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES pcmazing_projects(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_task_comments_task
  ON pcmazing_project_task_comments (task_id, created_at ASC, id ASC);

CREATE TABLE IF NOT EXISTS pcmazing_project_task_attachments (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES pcmazing_project_tasks(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES pcmazing_projects(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  kind VARCHAR(20) NOT NULL DEFAULT 'file',
  created_by_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pcmazing_project_task_attachments_kind_check
    CHECK (kind IN ('screenshot', 'file'))
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_task_attachments_task
  ON pcmazing_project_task_attachments (task_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS pcmazing_project_task_activity_log (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES pcmazing_projects(id) ON DELETE CASCADE,
  phase_id BIGINT,
  task_id BIGINT,
  task_title VARCHAR(200) NOT NULL,
  epic_id BIGINT,
  epic_title VARCHAR(200),
  action_type VARCHAR(80) NOT NULL,
  actor_user_id BIGINT,
  actor_user_source VARCHAR(40),
  actor_name VARCHAR(200),
  from_status VARCHAR(30),
  to_status VARCHAR(30),
  details TEXT,
  meta_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pcmazing_project_task_activity_action_check
    CHECK (action_type IN (
      'created',
      'edited',
      'moved',
      'deleted',
      'comment_added',
      'attachment_added',
      'attachment_deleted'
    )),
  CONSTRAINT pcmazing_project_task_activity_actor_source_check
    CHECK (
      actor_user_source IS NULL
      OR actor_user_source IN ('pcmazing_admin_users', 'tblusers')
    )
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_task_activity_project
  ON pcmazing_project_task_activity_log (project_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_pcmazing_project_task_activity_phase
  ON pcmazing_project_task_activity_log (project_id, phase_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_pcmazing_project_task_activity_task
  ON pcmazing_project_task_activity_log (task_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_pcmazing_project_task_activity_created
  ON pcmazing_project_task_activity_log (created_at DESC, id DESC);

-- =============================================================================
-- Payroll, attendance, employee workspace
-- =============================================================================

CREATE TABLE IF NOT EXISTS pcmazing_user_payroll (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_source VARCHAR(40) NOT NULL,
  employee_code VARCHAR(50),
  department VARCHAR(100),
  position_title VARCHAR(100),
  salary_type VARCHAR(30) NOT NULL DEFAULT 'monthly',
  monthly_salary NUMERIC(12, 2),
  fixed_monthly_salary NUMERIC(12, 2),
  payout_method VARCHAR(20) NOT NULL DEFAULT 'cash',
  bank_details TEXT,
  qr_image_url VARCHAR(500),
  payroll_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pcmazing_user_payroll_user UNIQUE (user_id, user_source)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_user_payroll_enabled
  ON pcmazing_user_payroll (payroll_enabled)
  WHERE payroll_enabled = TRUE;

CREATE TABLE IF NOT EXISTS pcmazing_attendance (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_source VARCHAR(40) NOT NULL,
  username VARCHAR(80) NOT NULL,
  work_date DATE NOT NULL,
  time_in TIMESTAMPTZ,
  time_out TIMESTAMPTZ,
  time_in_selfie_url VARCHAR(500),
  time_out_selfie_url VARCHAR(500),
  overtime_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
  overtime_status VARCHAR(20) NOT NULL DEFAULT 'none',
  overtime_reviewed_by BIGINT,
  overtime_reviewed_at TIMESTAMPTZ,
  overtime_review_note VARCHAR(255),
  adjustment_type VARCHAR(20),
  requested_time_out TIMESTAMPTZ,
  adjustment_selfie_url VARCHAR(500),
  adjustment_note VARCHAR(255),
  adjustment_status VARCHAR(20) NOT NULL DEFAULT 'none',
  adjustment_reviewed_by BIGINT,
  adjustment_reviewed_at TIMESTAMPTZ,
  adjustment_review_note VARCHAR(255),
  undertime_category VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pcmazing_attendance_day UNIQUE (user_id, user_source, work_date)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_attendance_work_date
  ON pcmazing_attendance (work_date DESC);
CREATE INDEX IF NOT EXISTS idx_pcmazing_attendance_username
  ON pcmazing_attendance (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_pcmazing_attendance_overtime_status
  ON pcmazing_attendance (overtime_status, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_pcmazing_attendance_adjustment_status
  ON pcmazing_attendance (adjustment_status, work_date DESC);

CREATE TABLE IF NOT EXISTS pcmazing_payroll_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  work_week VARCHAR(20) NOT NULL DEFAULT 'mon_fri',
  undertime_grace_minutes SMALLINT NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pcmazing_payroll_settings (id, work_week)
VALUES (1, 'mon_fri')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS pcmazing_payroll_runs (
  id BIGSERIAL PRIMARY KEY,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  period_days INT NOT NULL,
  label VARCHAR(120) NOT NULL,
  generated_by_user_id BIGINT,
  generated_by_username VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pcmazing_payroll_runs_period UNIQUE (date_from, date_to)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_payroll_runs_date_to
  ON pcmazing_payroll_runs (date_to DESC, id DESC);

CREATE TABLE IF NOT EXISTS pcmazing_generated_payslips (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES pcmazing_payroll_runs(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  user_source VARCHAR(40) NOT NULL,
  username VARCHAR(80) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  employee_code VARCHAR(50),
  department VARCHAR(100),
  salary_type VARCHAR(30) NOT NULL,
  salary_amount NUMERIC(12, 2),
  days_present INT NOT NULL DEFAULT 0,
  days_completed INT NOT NULL DEFAULT 0,
  total_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
  estimated_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payroll_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pcmazing_generated_payslips_run_user UNIQUE (run_id, user_id, user_source)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_generated_payslips_user
  ON pcmazing_generated_payslips (user_id, user_source, run_id DESC);

CREATE TABLE IF NOT EXISTS pcmazing_employee_day_offs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_source VARCHAR(40) NOT NULL,
  day_off_date DATE NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pcmazing_employee_day_offs UNIQUE (user_id, user_source, day_off_date)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_employee_day_offs_user_month
  ON pcmazing_employee_day_offs (user_id, user_source, day_off_date DESC);

CREATE TABLE IF NOT EXISTS pcmazing_employee_todos (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_source VARCHAR(40) NOT NULL,
  title VARCHAR(255) NOT NULL,
  notes TEXT,
  due_date DATE NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_employee_todos_user_due
  ON pcmazing_employee_todos (user_id, user_source, due_date DESC, is_done ASC);

CREATE TABLE IF NOT EXISTS pcmazing_employee_activities (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_source VARCHAR(40) NOT NULL,
  action_type VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  details TEXT,
  meta_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_employee_activities_user
  ON pcmazing_employee_activities (user_id, user_source, created_at DESC);

-- =============================================================================
-- Job orders / services
-- =============================================================================

CREATE TABLE IF NOT EXISTS pcmazing_service_types (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  labor_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pcmazing_service_types_name_active
  ON pcmazing_service_types (LOWER(TRIM(name)))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_service_types_active
  ON pcmazing_service_types (is_active)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS pcmazing_services (
  id BIGSERIAL PRIMARY KEY,
  service_name VARCHAR(180) NOT NULL,
  person_in_charge_user_id BIGINT,
  person_in_charge_source VARCHAR(40) NOT NULL DEFAULT 'tblusers',
  service_type VARCHAR(500) NOT NULL,
  base_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  labor NUMERIC(12, 2) NOT NULL DEFAULT 0,
  labor_discount_type VARCHAR(20) NOT NULL DEFAULT 'none',
  custom_discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(60) NOT NULL DEFAULT 'active',
  image_url TEXT,
  notes TEXT,
  reference_no VARCHAR(30),
  customer_name VARCHAR(180),
  customer_email VARCHAR(180),
  customer_contact VARCHAR(60),
  customer_address TEXT,
  device_brand VARCHAR(120),
  device_model VARCHAR(180),
  device_serial VARCHAR(120),
  downpayment NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(40),
  cancel_reason TEXT,
  refund_reason TEXT,
  refund_amount NUMERIC(12, 2),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_pcmazing_services_source
    CHECK (person_in_charge_source IN ('tblusers', 'pcmazing_admin_users'))
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_services_status
  ON pcmazing_services (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_services_type
  ON pcmazing_services (service_type)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcmazing_services_reference_no
  ON pcmazing_services (reference_no)
  WHERE reference_no IS NOT NULL;

CREATE TABLE IF NOT EXISTS pcmazing_service_parts (
  id BIGSERIAL PRIMARY KEY,
  service_id BIGINT NOT NULL REFERENCES pcmazing_services(id) ON DELETE CASCADE,
  material_id BIGINT REFERENCES tblmaterials(id),
  service_type_id BIGINT REFERENCES pcmazing_service_types(id),
  custom_item_name VARCHAR(180),
  brand_name VARCHAR(120),
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  labor NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'none',
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_service_parts_service
  ON pcmazing_service_parts (service_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_service_parts_material
  ON pcmazing_service_parts (material_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_service_parts_service_type
  ON pcmazing_service_parts (service_type_id)
  WHERE deleted_at IS NULL AND service_type_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS pcmazing_service_status_history (
  id BIGSERIAL PRIMARY KEY,
  service_id BIGINT NOT NULL REFERENCES pcmazing_services(id) ON DELETE CASCADE,
  from_status VARCHAR(60),
  to_status VARCHAR(60) NOT NULL,
  reason TEXT,
  changed_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_service_status_history_service
  ON pcmazing_service_status_history (service_id, created_at DESC);

-- =============================================================================
-- Printing
-- =============================================================================

CREATE TABLE IF NOT EXISTS pcmazing_printing_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  document_type VARCHAR(60) NOT NULL DEFAULT 'sales_receipt',
  paper_width_mm NUMERIC(6, 2) NOT NULL DEFAULT 210,
  paper_height_mm NUMERIC(6, 2) NOT NULL DEFAULT 297,
  layout_json JSONB NOT NULL DEFAULT '{"elements":[]}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pcmazing_printing_templates_name
  ON pcmazing_printing_templates (LOWER(TRIM(name)))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_printing_templates_document_type
  ON pcmazing_printing_templates (document_type)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS pcmazing_printing_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name VARCHAR(180) NOT NULL DEFAULT 'PCmazing Information Technology Services',
  store_address VARCHAR(500) NOT NULL DEFAULT '',
  store_phone VARCHAR(60) NOT NULL DEFAULT '',
  store_code VARCHAR(30) NOT NULL DEFAULT '1',
  workstation_no VARCHAR(30) NOT NULL DEFAULT '1',
  paper_size VARCHAR(20) NOT NULL DEFAULT 'A4',
  margin_top_mm NUMERIC(6, 2) NOT NULL DEFAULT 0,
  margin_right_mm NUMERIC(6, 2) NOT NULL DEFAULT 0,
  margin_bottom_mm NUMERIC(6, 2) NOT NULL DEFAULT 0,
  margin_left_mm NUMERIC(6, 2) NOT NULL DEFAULT 0,
  default_template_id INTEGER REFERENCES pcmazing_printing_templates(id) ON DELETE SET NULL,
  font_family VARCHAR(120) NOT NULL DEFAULT 'Times New Roman',
  show_page_numbers BOOLEAN NOT NULL DEFAULT TRUE,
  printer_connection_type VARCHAR(20) NOT NULL DEFAULT 'direct',
  printer_name VARCHAR(180) NOT NULL DEFAULT '',
  printer_host VARCHAR(255) NOT NULL DEFAULT '',
  printer_port INTEGER NOT NULL DEFAULT 9100,
  printer_bluetooth_device_id VARCHAR(255) NOT NULL DEFAULT '',
  printer_bluetooth_device_name VARCHAR(180) NOT NULL DEFAULT '',
  printer_auto_print BOOLEAN NOT NULL DEFAULT FALSE,
  printer_last_tested_at TIMESTAMPTZ,
  printer_last_test_status VARCHAR(40) NOT NULL DEFAULT 'never',
  printer_last_test_message VARCHAR(500) NOT NULL DEFAULT '',
  warranty_policy TEXT NOT NULL DEFAULT $warranty$
"PCmazing Warranty Policy"
Major PC Parts: 1-Year Warranty, 5-Day Replacement (Factory Defects Only)
PC Accessories: 5-Day Replacement, 1-Month Warranty (Factory Defects Only)
Original Receipt Required — NO RECEIPT, NO WARRANTY
Monitor dead pixels are NOT covered under replacement/warranty.
Physical, liquid, electrical, accidental, or customer-caused damage voids the warranty.
By purchasing this product, you acknowledge that you have read, understood, and accepted the terms and conditions of this warranty policy.
$warranty$,
  footer_note VARCHAR(500) NOT NULL DEFAULT 'This slip is not valid for input tax',
  thanks_message VARCHAR(500) NOT NULL DEFAULT 'Thanks for shopping with us!',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pcmazing_printing_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO pcmazing_printing_templates (
  name,
  document_type,
  paper_width_mm,
  paper_height_mm,
  layout_json,
  is_default,
  is_active
)
SELECT
  'Job Order Sales Receipt',
  'sales_receipt',
  210,
  297,
  $json${
    "elements": [
      {"id":"jo_printed_at","type":"field","fieldKey":"printedAt","label":"Printed","x":10,"y":8,"width":90,"height":5,"fontSize":10,"textAlign":"left"},
      {"id":"jo_store_code","type":"field","fieldKey":"storeCode","label":"Store","x":10,"y":13,"width":90,"height":5,"fontSize":10},
      {"id":"jo_workstation","type":"field","fieldKey":"workstationNo","label":"Workstation","x":10,"y":18,"width":90,"height":5,"fontSize":10},
      {"id":"jo_receipt_no","type":"field","fieldKey":"receiptNo","label":"Sales Receipt #","x":110,"y":8,"width":90,"height":5,"fontSize":11,"fontWeight":"bold","textAlign":"right"},
      {"id":"jo_printed_date","type":"field","fieldKey":"printedDate","label":"Date","x":110,"y":13,"width":90,"height":5,"fontSize":10,"textAlign":"right"},
      {"id":"jo_cashier","type":"field","fieldKey":"cashierName","label":"Cashier","x":110,"y":18,"width":90,"height":5,"fontSize":10,"textAlign":"right"},
      {"id":"jo_page","type":"field","fieldKey":"pageNumber","label":"Page","x":110,"y":23,"width":90,"height":5,"fontSize":10,"textAlign":"right"},
      {"id":"jo_reprinted","type":"field","fieldKey":"reprintedLabel","label":"Reprinted","x":10,"y":32,"width":190,"height":5,"fontSize":10,"fontWeight":"bold","textAlign":"center"},
      {"id":"jo_logo","type":"image","fieldKey":"storeLogo","label":"Store logo","x":85,"y":38,"width":40,"height":18},
      {"id":"jo_store_name","type":"field","fieldKey":"storeName","label":"Store name","x":10,"y":58,"width":190,"height":8,"fontSize":13,"fontWeight":"bold","textAlign":"center"},
      {"id":"jo_store_address","type":"field","fieldKey":"storeAddress","label":"Store address","x":10,"y":67,"width":190,"height":6,"fontSize":11,"textAlign":"center"},
      {"id":"jo_bill_to","type":"field","fieldKey":"billToLine","label":"Bill To / Contact","x":10,"y":78,"width":190,"height":6,"fontSize":11},
      {"id":"jo_address","type":"field","fieldKey":"addressLine","label":"Address","x":10,"y":84,"width":190,"height":8,"fontSize":11},
      {"id":"jo_line_items","type":"table","fieldKey":"lineItems","label":"Line items","x":10,"y":94,"width":190,"height":70,"fontSize":10},
      {"id":"jo_discount_total","type":"field","fieldKey":"discountTotal","label":"Total Sales Discounts","x":10,"y":168,"width":90,"height":6,"fontSize":11},
      {"id":"jo_subtotal","type":"field","fieldKey":"subtotal","label":"Subtotal","x":120,"y":168,"width":80,"height":6,"fontSize":11,"textAlign":"right"},
      {"id":"jo_receipt_total","type":"field","fieldKey":"receiptTotal","label":"RECEIPT TOTAL","x":120,"y":176,"width":80,"height":7,"fontSize":12,"fontWeight":"bold","textAlign":"right"},
      {"id":"jo_remarks","type":"field","fieldKey":"jobNotes","label":"Remarks","x":10,"y":186,"width":190,"height":16,"fontSize":11},
      {"id":"jo_warranty","type":"field","fieldKey":"warrantyPolicy","label":"Warranty policy","x":20,"y":206,"width":170,"height":36,"fontSize":10,"textAlign":"center"},
      {"id":"jo_footer_note","type":"field","fieldKey":"footerNote","label":"Footer tax note","x":10,"y":246,"width":190,"height":5,"fontSize":10,"textAlign":"center"},
      {"id":"jo_thanks","type":"field","fieldKey":"thanksMessage","label":"Thanks message","x":10,"y":252,"width":190,"height":5,"fontSize":11,"fontWeight":"bold","textAlign":"center"},
      {"id":"jo_barcode","type":"field","fieldKey":"barcode","label":"Barcode","x":70,"y":260,"width":70,"height":16,"fontSize":10,"textAlign":"center"},
      {"id":"jo_signature","type":"field","fieldKey":"signatureLine","label":"Signature","x":10,"y":280,"width":60,"height":8,"fontSize":10}
    ]
  }$json$::jsonb,
  TRUE,
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM pcmazing_printing_templates
  WHERE deleted_at IS NULL
    AND LOWER(TRIM(name)) = LOWER('Job Order Sales Receipt')
);

UPDATE pcmazing_printing_settings s
SET default_template_id = t.id,
    updated_at = NOW()
FROM pcmazing_printing_templates t
WHERE s.id = 1
  AND s.default_template_id IS NULL
  AND t.deleted_at IS NULL
  AND LOWER(TRIM(t.name)) = LOWER('Job Order Sales Receipt');

-- =============================================================================
-- Sales orders
-- =============================================================================

CREATE TABLE IF NOT EXISTS pcmazing_sales_orders (
  id BIGSERIAL PRIMARY KEY,
  reference_no VARCHAR(30),
  customer_name VARCHAR(180) NOT NULL,
  customer_phone VARCHAR(60),
  notes TEXT,
  custom_discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_void BOOLEAN NOT NULL DEFAULT FALSE,
  voided_at TIMESTAMPTZ,
  voided_by BIGINT,
  refund_reason TEXT,
  refund_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  refunded_at TIMESTAMPTZ,
  refunded_by BIGINT,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcmazing_sales_orders_reference_no
  ON pcmazing_sales_orders (reference_no)
  WHERE reference_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_sales_orders_sale_date
  ON pcmazing_sales_orders (sale_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_sales_orders_void
  ON pcmazing_sales_orders (is_void)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS pcmazing_sales_order_items (
  id BIGSERIAL PRIMARY KEY,
  sales_order_id BIGINT NOT NULL REFERENCES pcmazing_sales_orders(id) ON DELETE CASCADE,
  material_id BIGINT NOT NULL REFERENCES tblmaterials(id),
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_type VARCHAR(10) NOT NULL DEFAULT 'none',
  refunded_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_pcmazing_sales_order_items_discount_type
    CHECK (discount_type IN ('none', 'senior', 'pwd'))
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_sales_order_items_order
  ON pcmazing_sales_order_items (sales_order_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_sales_order_items_material
  ON pcmazing_sales_order_items (material_id)
  WHERE deleted_at IS NULL;

-- =============================================================================
-- Quotations (PCmazing-owned; legacy tblquotation is not created)
-- =============================================================================

CREATE TABLE IF NOT EXISTS pcmazing_quotations (
  id BIGSERIAL PRIMARY KEY,
  quote_no VARCHAR(30),
  quote_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_name VARCHAR(180) NOT NULL,
  customer_address TEXT,
  customer_contact_number VARCHAR(60),
  customer_email VARCHAR(180),
  remarks TEXT,
  custom_discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  validity_days INTEGER NOT NULL DEFAULT 7,
  expires_at TIMESTAMPTZ,
  converted_sales_id BIGINT,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_pcmazing_quotations_status
    CHECK (status IN ('draft', 'finalized', 'expired', 'converted')),
  CONSTRAINT chk_pcmazing_quotations_validity_days
    CHECK (validity_days >= 1 AND validity_days <= 365)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcmazing_quotations_quote_no
  ON pcmazing_quotations (quote_no)
  WHERE quote_no IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_quotations_quote_date
  ON pcmazing_quotations (quote_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_quotations_status
  ON pcmazing_quotations (status)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS pcmazing_quotation_items (
  id BIGSERIAL PRIMARY KEY,
  quotation_id BIGINT NOT NULL REFERENCES pcmazing_quotations(id) ON DELETE CASCADE,
  material_id BIGINT REFERENCES tblmaterials(id),
  description VARCHAR(500) NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_type VARCHAR(10) NOT NULL DEFAULT 'none',
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_pcmazing_quotation_items_discount_type
    CHECK (discount_type IN ('none', 'senior', 'pwd')),
  CONSTRAINT chk_pcmazing_quotation_items_quantity
    CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_quotation_items_quotation
  ON pcmazing_quotation_items (quotation_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_quotation_items_material
  ON pcmazing_quotation_items (material_id)
  WHERE deleted_at IS NULL AND material_id IS NOT NULL;

-- =============================================================================
-- Company expenses
-- =============================================================================

CREATE TABLE IF NOT EXISTS pcmazing_company_expenses (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'salary',
  vendor VARCHAR(160),
  payment_method VARCHAR(30) NOT NULL DEFAULT 'cash',
  status VARCHAR(20) NOT NULL DEFAULT 'paid',
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_company_expenses_date
  ON pcmazing_company_expenses (expense_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_company_expenses_category
  ON pcmazing_company_expenses (category, expense_date DESC)
  WHERE deleted_at IS NULL;
