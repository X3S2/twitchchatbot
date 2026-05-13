-- =============================================================
-- TwitchChatBot (TCB) — PostgreSQL 16 Vollständiges Schema
-- Version: 0.1.0 | Stand: 13.05.2026
-- =============================================================

-- UUID-Erweiterung
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- CORE / AUTH
-- =============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twitch_id       VARCHAR(64) UNIQUE NOT NULL,
    twitch_username VARCHAR(128) NOT NULL,
    display_name    VARCHAR(128),
    avatar_url      TEXT,
    role            VARCHAR(32) NOT NULL DEFAULT 'streamer' CHECK (role IN ('admin', 'streamer')),
    dark_mode       BOOLEAN NOT NULL DEFAULT FALSE,
    language        VARCHAR(8) NOT NULL DEFAULT 'de' CHECK (language IN ('de', 'en')),
    timezone        VARCHAR(64) NOT NULL DEFAULT 'Europe/Berlin',
    is_banned       BOOLEAN NOT NULL DEFAULT FALSE,
    ban_reason      TEXT,
    soft_delete_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token   VARCHAR(512) UNIQUE NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app_settings (
    id                      SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- Singleton
    client_id_enc           TEXT,       -- Fernet-verschlüsselt
    client_secret_enc       TEXT,       -- Fernet-verschlüsselt
    bot_username            VARCHAR(128),
    bot_token_enc           TEXT,       -- Fernet-verschlüsselt
    bot_user_id             VARCHAR(64),
    global_retention_days   INTEGER NOT NULL DEFAULT 180,
    reconnect_mode_default  VARCHAR(32) NOT NULL DEFAULT 'unlimited' CHECK (reconnect_mode_default IN ('unlimited', 'limited')),
    reconnect_max_attempts  INTEGER NOT NULL DEFAULT 10,
    maintenance_mode        BOOLEAN NOT NULL DEFAULT FALSE,
    maintenance_message     TEXT NOT NULL DEFAULT 'Das System wird gerade gewartet. Bitte versuche es später erneut.',
    global_timezone         VARCHAR(64) NOT NULL DEFAULT 'Europe/Berlin',
    setup_completed         BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Singleton initialisieren
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE legal_pages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        VARCHAR(64) UNIQUE NOT NULL,  -- 'impressum', 'datenschutz'
    title_de    VARCHAR(256) NOT NULL DEFAULT '',
    title_en    VARCHAR(256) NOT NULL DEFAULT '',
    content_de  TEXT NOT NULL DEFAULT '',
    content_en  TEXT NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  UUID REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO legal_pages (slug, title_de, title_en) VALUES
    ('impressum', 'Impressum', 'Legal Notice'),
    ('datenschutz', 'Datenschutzerklärung', 'Privacy Policy')
ON CONFLICT DO NOTHING;

-- =============================================================
-- TENANT-SYSTEM
-- =============================================================

CREATE TABLE tenants (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    twitch_channel          VARCHAR(128) NOT NULL,
    twitch_broadcaster_id   VARCHAR(64) NOT NULL,
    -- Bot-Konfiguration
    bot_mode                VARCHAR(32) NOT NULL DEFAULT 'shared' CHECK (bot_mode IN ('shared', 'own_bot', 'own_full')),
    own_client_id_enc       TEXT,
    own_client_secret_enc   TEXT,
    own_bot_token_enc       TEXT,
    own_bot_username        VARCHAR(128),
    own_bot_user_id         VARCHAR(64),
    -- Einstellungen
    stream_awareness        BOOLEAN NOT NULL DEFAULT FALSE,
    bot_language            VARCHAR(8) NOT NULL DEFAULT 'de' CHECK (bot_language IN ('de', 'en')),
    reconnect_mode          VARCHAR(32) NOT NULL DEFAULT 'unlimited' CHECK (reconnect_mode IN ('unlimited', 'limited')),
    reconnect_max_attempts  INTEGER NOT NULL DEFAULT 10,
    retention_days          INTEGER NOT NULL DEFAULT 180,
    regex_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
    new_mod_default_role    VARCHAR(32) NOT NULL DEFAULT 'viewer' CHECK (new_mod_default_role IN ('editor', 'viewer')),
    -- Freigabe
    approved                BOOLEAN NOT NULL DEFAULT FALSE,
    approval_requested_at   TIMESTAMPTZ,
    approved_at             TIMESTAMPTZ,
    approved_by             UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tenant_moderators (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    twitch_user_id  VARCHAR(64) NOT NULL,
    twitch_username VARCHAR(128) NOT NULL,
    role            VARCHAR(32) NOT NULL DEFAULT 'viewer' CHECK (role IN ('editor', 'viewer')),
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    revoked_at      TIMESTAMPTZ,
    UNIQUE(tenant_id, twitch_user_id)
);

CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
    actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_name  VARCHAR(128),
    action      VARCHAR(128) NOT NULL,
    detail      JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE TABLE bot_instances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    status          VARCHAR(32) NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'connecting', 'error')),
    stream_live     BOOLEAN NOT NULL DEFAULT FALSE,
    last_heartbeat  TIMESTAMPTZ,
    connected_at    TIMESTAMPTZ,
    error_message   TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dashboard_widget_configs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    config      JSONB NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

-- =============================================================
-- CHAT-FILTER
-- =============================================================

CREATE TABLE chat_filters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(128) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    test_mode       BOOLEAN NOT NULL DEFAULT FALSE,
    case_sensitive  BOOLEAN NOT NULL DEFAULT FALSE,
    priority        INTEGER NOT NULL DEFAULT 100,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_filter_terms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filter_id   UUID NOT NULL REFERENCES chat_filters(id) ON DELETE CASCADE,
    term        VARCHAR(512) NOT NULL,
    is_regex    BOOLEAN NOT NULL DEFAULT FALSE,
    is_whitelist BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE chat_filter_tiers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filter_id           UUID NOT NULL REFERENCES chat_filters(id) ON DELETE CASCADE,
    tier_order          SMALLINT NOT NULL,
    threshold           INTEGER NOT NULL,
    window_minutes      INTEGER NOT NULL DEFAULT 60,
    action              VARCHAR(32) NOT NULL CHECK (action IN ('warn', 'timeout', 'ban', 'delete')),
    duration_seconds    INTEGER,  -- für timeout
    message_template    TEXT NOT NULL DEFAULT '',
    UNIQUE(filter_id, tier_order)
);

CREATE TABLE chat_filter_violations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filter_id       UUID NOT NULL REFERENCES chat_filters(id) ON DELETE CASCADE,
    twitch_user_id  VARCHAR(64) NOT NULL,
    count           INTEGER NOT NULL DEFAULT 0,
    window_start    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(filter_id, twitch_user_id)
);

CREATE TABLE chat_filter_hits (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filter_id           UUID NOT NULL REFERENCES chat_filters(id) ON DELETE CASCADE,
    tier_id             UUID REFERENCES chat_filter_tiers(id) ON DELETE SET NULL,
    twitch_user_id      VARCHAR(64) NOT NULL,
    twitch_username     VARCHAR(128),
    message_text        TEXT,
    context_before      JSONB,  -- Array von bis zu 3 vorherigen Nachrichten
    context_after       JSONB,  -- Array von bis zu 3 nachfolgenden Nachrichten
    test_mode           BOOLEAN NOT NULL DEFAULT FALSE,
    action_taken        VARCHAR(32),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_filter_hits_filter_id ON chat_filter_hits(filter_id);
CREATE INDEX idx_chat_filter_hits_created_at ON chat_filter_hits(created_at DESC);

-- =============================================================
-- NAME-FILTER
-- =============================================================

CREATE TABLE name_filters (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        VARCHAR(128) NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    test_mode   BOOLEAN NOT NULL DEFAULT FALSE,
    priority    INTEGER NOT NULL DEFAULT 100,
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE name_filter_patterns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filter_id       UUID NOT NULL REFERENCES name_filters(id) ON DELETE CASCADE,
    pattern         VARCHAR(512) NOT NULL,
    is_regex        BOOLEAN NOT NULL DEFAULT FALSE,
    is_whitelist    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE name_filter_tiers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filter_id           UUID NOT NULL REFERENCES name_filters(id) ON DELETE CASCADE,
    tier_order          SMALLINT NOT NULL,
    threshold           INTEGER NOT NULL DEFAULT 1,
    window_minutes      INTEGER NOT NULL DEFAULT 60,
    action              VARCHAR(32) NOT NULL CHECK (action IN ('warn', 'timeout', 'ban')),
    duration_seconds    INTEGER,
    message_template    TEXT NOT NULL DEFAULT '',
    UNIQUE(filter_id, tier_order)
);

-- =============================================================
-- BAN-SYSTEM
-- =============================================================

CREATE TABLE twitch_users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twitch_id               VARCHAR(64) UNIQUE NOT NULL,
    current_username        VARCHAR(128) NOT NULL,
    username_history        JSONB NOT NULL DEFAULT '[]',  -- [{username, seen_at}]
    first_seen              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_twitch_users_username ON twitch_users(current_username);

CREATE TABLE bans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    twitch_user_id      VARCHAR(64) NOT NULL,
    twitch_username     VARCHAR(128),
    type                VARCHAR(32) NOT NULL CHECK (type IN ('permanent', 'timeout')),
    duration_seconds    INTEGER,
    reason              TEXT,
    source              VARCHAR(64) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'chat_filter', 'name_filter', 'scan', 'shared', 'multi_banner', 'import')),
    source_filter_id    UUID,
    failover_protected  BOOLEAN NOT NULL DEFAULT FALSE,
    note                TEXT,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unbanned_at         TIMESTAMPTZ,
    unbanned_by         UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_bans_tenant_id ON bans(tenant_id);
CREATE INDEX idx_bans_twitch_user_id ON bans(twitch_user_id);

CREATE TABLE shared_ban_connections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_a_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tenant_b_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    status              VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'dissolved')),
    -- Tenant A Einstellungen
    a_auto_ban          BOOLEAN NOT NULL DEFAULT FALSE,
    a_notify            BOOLEAN NOT NULL DEFAULT TRUE,
    a_share_permanent   BOOLEAN NOT NULL DEFAULT TRUE,
    a_share_timeout     BOOLEAN NOT NULL DEFAULT FALSE,
    -- Tenant B Einstellungen
    b_auto_ban          BOOLEAN NOT NULL DEFAULT FALSE,
    b_notify            BOOLEAN NOT NULL DEFAULT TRUE,
    b_share_permanent   BOOLEAN NOT NULL DEFAULT TRUE,
    b_share_timeout     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_a_id, tenant_b_id)
);

CREATE TABLE ban_invitations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    to_tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    status          VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE batch_jobs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    type        VARCHAR(64) NOT NULL CHECK (type IN ('batch_ban', 'batch_unban', 'retroactive_sync', 'name_scan')),
    status      VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    total       INTEGER NOT NULL DEFAULT 0,
    processed   INTEGER NOT NULL DEFAULT 0,
    failed      INTEGER NOT NULL DEFAULT 0,
    error_log   JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);

-- =============================================================
-- USER-DATENBANK (Ausnahmen)
-- =============================================================

CREATE TABLE tenant_user_exclusions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    twitch_user_id      VARCHAR(64) NOT NULL,
    twitch_username     VARCHAR(128),
    exclude_chat_filter BOOLEAN NOT NULL DEFAULT FALSE,
    exclude_name_filter BOOLEAN NOT NULL DEFAULT FALSE,
    exclude_scan        BOOLEAN NOT NULL DEFAULT FALSE,
    note                TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, twitch_user_id)
);

CREATE TABLE global_user_exclusions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twitch_user_id      VARCHAR(64) UNIQUE NOT NULL,
    twitch_username     VARCHAR(128),
    exclude_chat_filter BOOLEAN NOT NULL DEFAULT FALSE,
    exclude_name_filter BOOLEAN NOT NULL DEFAULT FALSE,
    exclude_scan        BOOLEAN NOT NULL DEFAULT FALSE,
    note                TEXT,
    set_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- CHAT-BEFEHLE
-- =============================================================

CREATE TABLE chat_commands (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    command_name        VARCHAR(64) NOT NULL,
    permission_level    VARCHAR(32) NOT NULL DEFAULT 'moderator' CHECK (permission_level IN ('everyone', 'subscriber', 'regular', 'vip', 'moderator', 'editor', 'broadcaster')),
    global_cooldown_sec INTEGER NOT NULL DEFAULT 5,
    user_cooldown_sec   INTEGER NOT NULL DEFAULT 10,
    action_type         VARCHAR(64) NOT NULL,
    response_template   TEXT,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    is_builtin          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, command_name)
);

CREATE TABLE command_cooldown_tracking (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_id  UUID NOT NULL REFERENCES chat_commands(id) ON DELETE CASCADE,
    user_id     VARCHAR(64),  -- NULL = global cooldown
    last_used   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(command_id, user_id)
);

-- =============================================================
-- NAME-SCAN (Admin)
-- =============================================================

CREATE TABLE name_scan_filters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(128) NOT NULL,
    pattern_rules   JSONB NOT NULL DEFAULT '[]',
    whitelist       JSONB NOT NULL DEFAULT '[]',
    blacklist       JSONB NOT NULL DEFAULT '[]',
    trigger_action  VARCHAR(32) CHECK (trigger_action IN ('ban', 'flag', 'notify')),
    trigger_message TEXT,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE name_scan_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_filter_id  UUID NOT NULL REFERENCES name_scan_filters(id) ON DELETE CASCADE,
    twitch_user_id  VARCHAR(64) NOT NULL,
    twitch_username VARCHAR(128),
    found_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    banned_globally BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(scan_filter_id, twitch_user_id)
);

CREATE TABLE name_scan_tenant_optins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_filter_id  UUID NOT NULL REFERENCES name_scan_filters(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    auto_ban        BOOLEAN NOT NULL DEFAULT FALSE,
    opted_in_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(scan_filter_id, tenant_id)
);

-- =============================================================
-- NOTIFICATIONS
-- =============================================================

CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(64) NOT NULL,  -- 'ban_shared', 'bot_error', 'mod_lost', 'batch_done', etc.
    title       VARCHAR(256) NOT NULL,
    body        TEXT,
    read        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);

-- =============================================================
-- FILTER-VORLAGEN (Admin erstellt, Tenants können kopieren)
-- =============================================================

CREATE TABLE filter_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type        VARCHAR(32) NOT NULL CHECK (type IN ('chat', 'name')),
    name        VARCHAR(128) NOT NULL,
    description TEXT,
    config      JSONB NOT NULL DEFAULT '{}',  -- vollständige Filter-Konfiguration als JSON
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- HILFSFUNKTIONEN & TRIGGER
-- =============================================================

-- updated_at automatisch aktualisieren
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_chat_filters_updated_at BEFORE UPDATE ON chat_filters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_name_filters_updated_at BEFORE UPDATE ON name_filters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_chat_commands_updated_at BEFORE UPDATE ON chat_commands FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_shared_ban_connections_updated_at BEFORE UPDATE ON shared_ban_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_bot_instances_updated_at BEFORE UPDATE ON bot_instances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_filter_templates_updated_at BEFORE UPDATE ON filter_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_name_scan_filters_updated_at BEFORE UPDATE ON name_scan_filters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
