-- ============================================================================
-- Divvy-Jones Database Schema
-- PostgreSQL 15+
-- Generated from ERD.mermaid
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- LOOKUP TABLES (Enums)
-- ============================================================================

CREATE TABLE auth_provider_type (
    value TEXT PRIMARY KEY
);
INSERT INTO auth_provider_type (value) VALUES
    ('email'), ('google'), ('apple'), ('facebook'), ('line');

CREATE TABLE membership_role (
    value TEXT PRIMARY KEY
);
INSERT INTO membership_role (value) VALUES
    ('owner'), ('admin'), ('member'), ('viewer');

CREATE TABLE membership_status (
    value TEXT PRIMARY KEY
);
INSERT INTO membership_status (value) VALUES
    ('active'), ('inactive'), ('pending'), ('banned');

CREATE TABLE group_icon (
    value TEXT PRIMARY KEY
);
INSERT INTO group_icon (value) VALUES
    ('home'), ('work'), ('travel'), ('food'), ('shopping'), ('entertainment'),
    ('transport'), ('utilities'), ('health'), ('education'), ('gift'), ('other');

CREATE TABLE color_name (
    value TEXT PRIMARY KEY
);
INSERT INTO color_name (value) VALUES
    ('red'), ('orange'), ('yellow'), ('green'), ('teal'), ('blue'),
    ('indigo'), ('purple'), ('pink'), ('gray');

CREATE TABLE discount_mode (
    value TEXT PRIMARY KEY
);
INSERT INTO discount_mode (value) VALUES
    ('percent'), ('fixed');

CREATE TABLE share_mode (
    value TEXT PRIMARY KEY
);
INSERT INTO share_mode (value) VALUES
    ('equal'), ('weight'), ('exact'), ('percent');

CREATE TABLE settlement_status (
    value TEXT PRIMARY KEY
);
INSERT INTO settlement_status (value) VALUES
    ('pending'), ('confirmed'), ('rejected'), ('cancelled');

CREATE TABLE evidence_target (
    value TEXT PRIMARY KEY
);
INSERT INTO evidence_target (value) VALUES
    ('expense'), ('settlement');

CREATE TABLE leave_request_status (
    value TEXT PRIMARY KEY
);
INSERT INTO leave_request_status (value) VALUES
    ('pending'), ('approved'), ('rejected'), ('cancelled');

CREATE TABLE notification_type (
    value TEXT PRIMARY KEY
);
INSERT INTO notification_type (value) VALUES
    ('expense_created'), ('expense_updated'), ('expense_deleted'),
    ('settlement_requested'), ('settlement_confirmed'), ('settlement_rejected'),
    ('member_joined'), ('member_left'), ('member_removed'),
    ('group_invite'), ('leave_request'), ('reminder');

CREATE TABLE activity_action (
    value TEXT PRIMARY KEY
);
INSERT INTO activity_action (value) VALUES
    ('create'), ('update'), ('delete'), ('restore'),
    ('join'), ('leave'), ('invite'), ('remove'), ('approve'), ('reject'),
    ('settle'), ('confirm'), ('cancel');

-- ============================================================================
-- CURRENCIES & FX RATES
-- ============================================================================

CREATE TABLE currencies (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimals SMALLINT NOT NULL DEFAULT 2
);

-- Seed common currencies
INSERT INTO currencies (code, name, symbol, decimals) VALUES
    ('USD', 'US Dollar', '$', 2),
    ('EUR', 'Euro', '€', 2),
    ('GBP', 'British Pound', '£', 2),
    ('JPY', 'Japanese Yen', '¥', 0),
    ('THB', 'Thai Baht', '฿', 2),
    ('SGD', 'Singapore Dollar', 'S$', 2),
    ('MYR', 'Malaysian Ringgit', 'RM', 2),
    ('IDR', 'Indonesian Rupiah', 'Rp', 0),
    ('PHP', 'Philippine Peso', '₱', 2),
    ('VND', 'Vietnamese Dong', '₫', 0),
    ('KRW', 'South Korean Won', '₩', 0),
    ('CNY', 'Chinese Yuan', '¥', 2),
    ('HKD', 'Hong Kong Dollar', 'HK$', 2),
    ('TWD', 'Taiwan Dollar', 'NT$', 0),
    ('AUD', 'Australian Dollar', 'A$', 2),
    ('NZD', 'New Zealand Dollar', 'NZ$', 2),
    ('INR', 'Indian Rupee', '₹', 2);

CREATE TABLE fx_rates (
    id BIGSERIAL PRIMARY KEY,
    base_code TEXT NOT NULL REFERENCES currencies(code),
    quote_code TEXT NOT NULL REFERENCES currencies(code),
    rate NUMERIC(20, 10) NOT NULL,
    as_of TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fx_rates_different_currencies CHECK (base_code <> quote_code)
);

CREATE INDEX idx_fx_rates_pair_date ON fx_rates (base_code, quote_code, as_of DESC);
CREATE INDEX idx_fx_rates_as_of ON fx_rates (as_of DESC);

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT, -- nullable for OAuth-only users
    primary_auth_provider TEXT NOT NULL REFERENCES auth_provider_type(value),
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ads_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ -- soft delete
);

CREATE INDEX idx_users_email ON users (email) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_users_deleted_at ON users (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TABLE oauth_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL REFERENCES auth_provider_type(value),
    provider_uid TEXT NOT NULL,
    email_at_provider TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT oauth_accounts_unique_provider UNIQUE (provider, provider_uid)
);

CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts (user_id);

-- ============================================================================
-- USER SETTINGS
-- ============================================================================

CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    language_code TEXT DEFAULT 'en',
    default_currency_code TEXT REFERENCES currencies(code),
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    timezone TEXT DEFAULT 'UTC',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PLANS & SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    price_cents_month INTEGER NOT NULL DEFAULT 0,
    ads_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default plans
INSERT INTO plans (id, code, name, price_cents_month, ads_enabled) VALUES
    ('00000000-0000-0000-0000-000000000001', 'free', 'Free', 0, TRUE),
    ('00000000-0000-0000-0000-000000000002', 'pro', 'Pro', 499, FALSE),
    ('00000000-0000-0000-0000-000000000003', 'team', 'Team', 999, FALSE);

CREATE TABLE plan_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    int_value INTEGER,
    bool_value BOOLEAN,
    text_value TEXT,

    CONSTRAINT plan_features_unique_key UNIQUE (plan_id, key)
);

-- Seed plan features
INSERT INTO plan_features (plan_id, key, int_value) VALUES
    ('00000000-0000-0000-0000-000000000001', 'max_groups', 3),
    ('00000000-0000-0000-0000-000000000001', 'max_members_per_group', 10),
    ('00000000-0000-0000-0000-000000000002', 'max_groups', 20),
    ('00000000-0000-0000-0000-000000000002', 'max_members_per_group', 50),
    ('00000000-0000-0000-0000-000000000003', 'max_groups', -1), -- unlimited
    ('00000000-0000-0000-0000-000000000003', 'max_members_per_group', -1);

INSERT INTO plan_features (plan_id, key, bool_value) VALUES
    ('00000000-0000-0000-0000-000000000001', 'ocr_enabled', FALSE),
    ('00000000-0000-0000-0000-000000000002', 'ocr_enabled', TRUE),
    ('00000000-0000-0000-0000-000000000003', 'ocr_enabled', TRUE),
    ('00000000-0000-0000-0000-000000000003', 'priority_support', TRUE);

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    CONSTRAINT subscriptions_valid_dates CHECK (expires_at IS NULL OR expires_at > started_at)
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions (user_id);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions (expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- GROUPS & MEMBERS
-- ============================================================================

CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    label TEXT,
    icon TEXT REFERENCES group_icon(value) DEFAULT 'other',
    color TEXT REFERENCES color_name(value) DEFAULT 'blue',
    default_currency_code TEXT NOT NULL REFERENCES currencies(code) DEFAULT 'USD',
    region_code TEXT,
    join_code TEXT UNIQUE,
    qr_token TEXT UNIQUE,
    expires_at TIMESTAMPTZ, -- for join code expiry
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_groups_owner ON groups (owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_groups_join_code ON groups (join_code) WHERE join_code IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_groups_qr_token ON groups (qr_token) WHERE qr_token IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE group_currencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    currency_code TEXT NOT NULL REFERENCES currencies(code),

    CONSTRAINT group_currencies_unique UNIQUE (group_id, currency_code)
);

CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    role TEXT NOT NULL REFERENCES membership_role(value) DEFAULT 'member',
    status TEXT NOT NULL REFERENCES membership_status(value) DEFAULT 'active',
    is_guest BOOLEAN NOT NULL DEFAULT FALSE,
    origin_member_id UUID REFERENCES group_members(id), -- who invited this guest
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at TIMESTAMPTZ,

    CONSTRAINT group_members_unique UNIQUE (group_id, user_id)
);

CREATE INDEX idx_group_members_group_id ON group_members (group_id) WHERE left_at IS NULL;
CREATE INDEX idx_group_members_user_id ON group_members (user_id) WHERE left_at IS NULL;

-- ============================================================================
-- EXPENSES & ITEMS
-- ============================================================================

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_by_member_id UUID NOT NULL REFERENCES group_members(id),
    name TEXT NOT NULL,
    label TEXT,
    icon TEXT REFERENCES group_icon(value) DEFAULT 'other',
    color TEXT REFERENCES color_name(value),
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    currency_code TEXT NOT NULL REFERENCES currencies(code),
    subtotal NUMERIC(20, 4) NOT NULL, -- base amount before adjustments
    service_charge_pct NUMERIC(5, 2) DEFAULT 0,
    vat_pct NUMERIC(5, 2) DEFAULT 0,
    extra_discount_value NUMERIC(20, 4) DEFAULT 0,
    extra_discount_mode TEXT REFERENCES discount_mode(value),
    expense_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- when expense occurred
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ -- soft delete
);

CREATE INDEX idx_expenses_group_id ON expenses (group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_created_by ON expenses (created_by_member_id);
CREATE INDEX idx_expenses_date ON expenses (expense_date DESC) WHERE deleted_at IS NULL;

CREATE TABLE expense_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity NUMERIC(10, 3) NOT NULL DEFAULT 1,
    unit_value NUMERIC(20, 4) NOT NULL,
    currency_code TEXT NOT NULL REFERENCES currencies(code),
    apply_service_charge BOOLEAN NOT NULL DEFAULT TRUE,
    apply_vat BOOLEAN NOT NULL DEFAULT TRUE,
    apply_extra_discount BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expense_items_expense_id ON expense_items (expense_id);

CREATE TABLE expense_item_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES expense_items(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES group_members(id),
    share_mode TEXT NOT NULL REFERENCES share_mode(value) DEFAULT 'equal',
    weight NUMERIC(10, 4) DEFAULT 1, -- used when share_mode = 'weight'
    exact_amount NUMERIC(20, 4), -- used when share_mode = 'exact'

    CONSTRAINT expense_item_members_unique UNIQUE (item_id, member_id)
);

CREATE INDEX idx_expense_item_members_item_id ON expense_item_members (item_id);
CREATE INDEX idx_expense_item_members_member_id ON expense_item_members (member_id);

CREATE TABLE expense_payers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES group_members(id),
    amount NUMERIC(20, 4) NOT NULL,
    currency_code TEXT NOT NULL REFERENCES currencies(code),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT expense_payers_unique UNIQUE (expense_id, member_id),
    CONSTRAINT expense_payers_positive_amount CHECK (amount > 0)
);

CREATE INDEX idx_expense_payers_expense_id ON expense_payers (expense_id);
CREATE INDEX idx_expense_payers_member_id ON expense_payers (member_id);

-- ============================================================================
-- OCR RECEIPTS
-- ============================================================================

CREATE TABLE ocr_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    source TEXT NOT NULL, -- 'camera', 'gallery', 'file'
    raw_text TEXT,
    parsed_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ocr_receipts_expense_id ON ocr_receipts (expense_id);

-- ============================================================================
-- SETTLEMENTS
-- ============================================================================

CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    payer_member_id UUID NOT NULL REFERENCES group_members(id),
    payee_member_id UUID NOT NULL REFERENCES group_members(id),
    amount NUMERIC(20, 4) NOT NULL,
    currency_code TEXT NOT NULL REFERENCES currencies(code),
    by_items BOOLEAN NOT NULL DEFAULT FALSE, -- true if linked to specific items
    status TEXT NOT NULL REFERENCES settlement_status(value) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT settlements_different_members CHECK (payer_member_id <> payee_member_id),
    CONSTRAINT settlements_positive_amount CHECK (amount > 0)
);

CREATE INDEX idx_settlements_group_id ON settlements (group_id);
CREATE INDEX idx_settlements_payer ON settlements (payer_member_id);
CREATE INDEX idx_settlements_payee ON settlements (payee_member_id);
CREATE INDEX idx_settlements_status ON settlements (status) WHERE status = 'pending';

-- ============================================================================
-- EVIDENCES (Files/Attachments)
-- ============================================================================

CREATE TABLE evidences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target TEXT NOT NULL REFERENCES evidence_target(value),
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
    settlement_id UUID REFERENCES settlements(id) ON DELETE CASCADE,
    file_key TEXT NOT NULL, -- S3/storage key
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure exactly one target is set
    CONSTRAINT evidences_single_target CHECK (
        (target = 'expense' AND expense_id IS NOT NULL AND settlement_id IS NULL) OR
        (target = 'settlement' AND settlement_id IS NOT NULL AND expense_id IS NULL)
    )
);

CREATE INDEX idx_evidences_expense_id ON evidences (expense_id) WHERE expense_id IS NOT NULL;
CREATE INDEX idx_evidences_settlement_id ON evidences (settlement_id) WHERE settlement_id IS NOT NULL;

-- ============================================================================
-- LEAVE REQUESTS
-- ============================================================================

CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES group_members(id),
    reason TEXT,
    has_unsettled BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by_member_id UUID REFERENCES group_members(id),
    approved_at TIMESTAMPTZ,
    status TEXT NOT NULL REFERENCES leave_request_status(value) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leave_requests_group_id ON leave_requests (group_id);
CREATE INDEX idx_leave_requests_member_id ON leave_requests (member_id);
CREATE INDEX idx_leave_requests_status ON leave_requests (status) WHERE status = 'pending';

-- ============================================================================
-- GROUP INVITES (Audit Trail)
-- ============================================================================

CREATE TABLE group_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    issued_by_member_id UUID NOT NULL REFERENCES group_members(id),
    method TEXT NOT NULL, -- 'link', 'qr', 'email', 'sms'
    code_snapshot TEXT, -- snapshot of join_code at time of invite
    qr_token_snapshot TEXT, -- snapshot of qr_token at time of invite
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_by_user_id UUID REFERENCES users(id),
    used_at TIMESTAMPTZ
);

CREATE INDEX idx_group_invites_group_id ON group_invites (group_id);
CREATE INDEX idx_group_invites_issued_by ON group_invites (issued_by_member_id);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL REFERENCES notification_type(value),
    title TEXT NOT NULL,
    body TEXT,
    data JSONB, -- additional payload
    reference_id UUID, -- generic FK to related entity
    reference_type TEXT, -- 'expense', 'settlement', 'group', etc.
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_notifications_unread ON notifications (user_id, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created_at ON notifications (created_at DESC);

-- ============================================================================
-- ACTIVITY LOG (Audit Trail)
-- ============================================================================

CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    actor_member_id UUID REFERENCES group_members(id), -- nullable for system actions
    action TEXT NOT NULL REFERENCES activity_action(value),
    entity_type TEXT NOT NULL, -- 'expense', 'settlement', 'member', etc.
    entity_id UUID NOT NULL,
    old_values JSONB, -- previous state
    new_values JSONB, -- new state
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_log_group_id ON activity_log (group_id);
CREATE INDEX idx_activity_log_actor ON activity_log (actor_member_id) WHERE actor_member_id IS NOT NULL;
CREATE INDEX idx_activity_log_entity ON activity_log (entity_type, entity_id);
CREATE INDEX idx_activity_log_created_at ON activity_log (created_at DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at
    BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expense_items_updated_at
    BEFORE UPDATE ON expense_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlements_updated_at
    BEFORE UPDATE ON settlements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active subscriptions view
CREATE VIEW active_subscriptions AS
SELECT
    s.*,
    p.code AS plan_code,
    p.name AS plan_name,
    p.ads_enabled
FROM subscriptions s
JOIN plans p ON s.plan_id = p.id
WHERE s.cancelled_at IS NULL
  AND (s.expires_at IS NULL OR s.expires_at > NOW());

-- Active group members view
CREATE VIEW active_group_members AS
SELECT
    gm.*,
    u.email,
    u.display_name,
    g.name AS group_name
FROM group_members gm
JOIN users u ON gm.user_id = u.id
JOIN groups g ON gm.group_id = g.id
WHERE gm.status = 'active'
  AND gm.left_at IS NULL
  AND g.deleted_at IS NULL
  AND u.deleted_at IS NULL;

-- Pending settlements view
CREATE VIEW pending_settlements AS
SELECT
    s.*,
    payer.user_id AS payer_user_id,
    payee.user_id AS payee_user_id,
    g.name AS group_name,
    c.symbol AS currency_symbol
FROM settlements s
JOIN group_members payer ON s.payer_member_id = payer.id
JOIN group_members payee ON s.payee_member_id = payee.id
JOIN groups g ON s.group_id = g.id
JOIN currencies c ON s.currency_code = c.code
WHERE s.status = 'pending';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE users IS 'User accounts with support for multiple auth providers';
COMMENT ON TABLE oauth_accounts IS 'OAuth provider connections for users';
COMMENT ON TABLE user_settings IS 'User preferences and notification settings';
COMMENT ON TABLE plans IS 'Subscription plan definitions';
COMMENT ON TABLE plan_features IS 'Feature flags and limits per plan';
COMMENT ON TABLE subscriptions IS 'User subscription history';
COMMENT ON TABLE currencies IS 'Supported currencies';
COMMENT ON TABLE fx_rates IS 'Historical exchange rates';
COMMENT ON TABLE groups IS 'Expense splitting groups';
COMMENT ON TABLE group_currencies IS 'Currencies enabled for a group';
COMMENT ON TABLE group_members IS 'Group membership with roles';
COMMENT ON TABLE expenses IS 'Expense records with tax/discount support';
COMMENT ON TABLE expense_items IS 'Line items within an expense';
COMMENT ON TABLE expense_item_members IS 'Who owes what for each item';
COMMENT ON TABLE expense_payers IS 'Who paid for each expense';
COMMENT ON TABLE ocr_receipts IS 'OCR results from receipt scanning';
COMMENT ON TABLE settlements IS 'Payment records between members';
COMMENT ON TABLE evidences IS 'File attachments for expenses/settlements';
COMMENT ON TABLE leave_requests IS 'Requests to leave a group';
COMMENT ON TABLE group_invites IS 'Audit trail for group invitations';
COMMENT ON TABLE notifications IS 'In-app notifications';
COMMENT ON TABLE activity_log IS 'Audit trail for all group actions';

COMMENT ON COLUMN expenses.subtotal IS 'Base amount before service charge, VAT, and discounts';
COMMENT ON COLUMN expenses.expense_date IS 'When the expense actually occurred (not creation time)';
COMMENT ON COLUMN settlements.by_items IS 'True if settlement is linked to specific expense items, false if aggregate balance';
COMMENT ON COLUMN group_members.origin_member_id IS 'For guests: the member who invited them';
