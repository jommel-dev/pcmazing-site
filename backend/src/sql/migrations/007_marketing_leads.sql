-- Marketing organization teams
CREATE TABLE IF NOT EXISTS pcmazing_marketing_teams (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  parent_team_id BIGINT REFERENCES pcmazing_marketing_teams(id) ON DELETE SET NULL,
  created_by_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_marketing_teams_parent
  ON pcmazing_marketing_teams(parent_team_id);

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
  ON pcmazing_marketing_team_members(user_id);

-- Client prospects for lead generation
CREATE TABLE IF NOT EXISTS pcmazing_client_prospects (
  id BIGSERIAL PRIMARY KEY,
  client_name VARCHAR(150) NOT NULL,
  company VARCHAR(150),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'picked_up', 'meeting_set', 'closed_won', 'closed_lost', 'no_response')),
  source VARCHAR(30) NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'import')),
  notes TEXT,
  assigned_user_id BIGINT,
  assigned_team_id BIGINT REFERENCES pcmazing_marketing_teams(id) ON DELETE SET NULL,
  picked_up_by BIGINT,
  picked_up_at TIMESTAMPTZ,
  created_by_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_prospects_status
  ON pcmazing_client_prospects(status);
CREATE INDEX IF NOT EXISTS idx_pcmazing_client_prospects_assigned_user
  ON pcmazing_client_prospects(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_pcmazing_client_prospects_picked_up_by
  ON pcmazing_client_prospects(picked_up_by);

-- Call / follow-up responses
CREATE TABLE IF NOT EXISTS pcmazing_client_responses (
  id BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL REFERENCES pcmazing_client_prospects(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  response_type VARCHAR(30) NOT NULL DEFAULT 'call'
    CHECK (response_type IN ('call', 'email', 'sms', 'meeting', 'other')),
  notes TEXT,
  outcome VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_responses_prospect
  ON pcmazing_client_responses(prospect_id);

-- Appointments with conflict prevention per assigned user
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
  ON pcmazing_client_appointments(user_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_pcmazing_client_appointments_prospect
  ON pcmazing_client_appointments(prospect_id);
