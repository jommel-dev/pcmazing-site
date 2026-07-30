-- Employee self-service: day offs, todos, activity feed (Sales ESS Phase 1)

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

COMMENT ON TABLE pcmazing_employee_day_offs IS 'Personal day-off markers for employee calendar (Sales ESS).';
COMMENT ON TABLE pcmazing_employee_todos IS 'Personal daily todos / schedules for employee dashboard.';
COMMENT ON TABLE pcmazing_employee_activities IS 'Personal activity feed; action_type can grow (job_order_*, note, etc.).';
