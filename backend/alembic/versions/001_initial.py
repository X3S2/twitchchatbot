"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-13

"""
from alembic import op

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # ── users ────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE users (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            twitch_id       VARCHAR(64) UNIQUE NOT NULL,
            twitch_username VARCHAR(128) NOT NULL,
            display_name    VARCHAR(128),
            avatar_url      TEXT,
            role            VARCHAR(32) NOT NULL DEFAULT 'streamer',
            dark_mode       BOOLEAN NOT NULL DEFAULT FALSE,
            language        VARCHAR(8) NOT NULL DEFAULT 'de',
            timezone        VARCHAR(64) NOT NULL DEFAULT 'Europe/Berlin',
            is_banned       BOOLEAN NOT NULL DEFAULT FALSE,
            ban_reason      TEXT,
            soft_delete_at  TIMESTAMPTZ,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── sessions ─────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE sessions (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            refresh_token   VARCHAR(512) UNIQUE NOT NULL,
            expires_at      TIMESTAMPTZ NOT NULL,
            ip_address      VARCHAR(45),
            user_agent      VARCHAR(512),
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── app_settings (Singleton) ──────────────────────────────────
    op.execute("""
        CREATE TABLE app_settings (
            id                      SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            client_id_enc           TEXT,
            client_secret_enc       TEXT,
            bot_username            VARCHAR(128),
            bot_token_enc           TEXT,
            bot_user_id             VARCHAR(64),
            global_retention_days   INTEGER NOT NULL DEFAULT 180,
            reconnect_mode_default  VARCHAR(32) NOT NULL DEFAULT 'unlimited',
            reconnect_max_attempts  INTEGER NOT NULL DEFAULT 10,
            maintenance_mode        BOOLEAN NOT NULL DEFAULT FALSE,
            maintenance_message     TEXT NOT NULL DEFAULT 'Das System wird gerade gewartet. Bitte versuche es später erneut.',
            global_timezone         VARCHAR(64) NOT NULL DEFAULT 'Europe/Berlin',
            setup_completed         BOOLEAN NOT NULL DEFAULT FALSE,
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("INSERT INTO app_settings (id) VALUES (1) ON CONFLICT DO NOTHING")

    # ── legal_pages ───────────────────────────────────────────────
    op.execute("""
        CREATE TABLE legal_pages (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            slug        VARCHAR(64) UNIQUE NOT NULL,
            title_de    VARCHAR(256) NOT NULL DEFAULT '',
            title_en    VARCHAR(256) NOT NULL DEFAULT '',
            content_de  TEXT NOT NULL DEFAULT '',
            content_en  TEXT NOT NULL DEFAULT '',
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_by  UUID REFERENCES users(id) ON DELETE SET NULL
        )
    """)
    op.execute("""
        INSERT INTO legal_pages (slug, title_de, title_en) VALUES
            ('impressum', 'Impressum', 'Legal Notice'),
            ('datenschutz', 'Datenschutzerklärung', 'Privacy Policy')
        ON CONFLICT DO NOTHING
    """)

    # ── tenants ───────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE tenants (
            id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id                 UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            channel_name            VARCHAR(128) UNIQUE NOT NULL,
            display_name            VARCHAR(128),
            bot_mode                VARCHAR(32) NOT NULL DEFAULT 'shared',
            own_client_id_enc       TEXT,
            own_client_secret_enc   TEXT,
            own_bot_token_enc       TEXT,
            own_bot_username        VARCHAR(128),
            own_bot_user_id         VARCHAR(64),
            stream_awareness        BOOLEAN NOT NULL DEFAULT FALSE,
            bot_language            VARCHAR(8) NOT NULL DEFAULT 'de',
            reconnect_mode          VARCHAR(32) NOT NULL DEFAULT 'unlimited',
            reconnect_max_attempts  INTEGER NOT NULL DEFAULT 10,
            retention_days          INTEGER NOT NULL DEFAULT 180,
            regex_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
            new_mod_default_role    VARCHAR(32) NOT NULL DEFAULT 'viewer',
            approved                BOOLEAN NOT NULL DEFAULT FALSE,
            approval_requested_at   TIMESTAMPTZ,
            stream_live             BOOLEAN NOT NULL DEFAULT FALSE,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── tenant_moderators ─────────────────────────────────────────
    op.execute("""
        CREATE TABLE tenant_moderators (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            twitch_user_id  VARCHAR(64) NOT NULL,
            twitch_username VARCHAR(128) NOT NULL,
            role            VARCHAR(32) NOT NULL DEFAULT 'viewer',
            granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            granted_by      UUID REFERENCES users(id) ON DELETE SET NULL,
            revoked_at      TIMESTAMPTZ,
            UNIQUE(tenant_id, twitch_user_id)
        )
    """)

    # ── audit_logs ────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE audit_logs (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id   UUID REFERENCES tenants(id) ON DELETE SET NULL,
            actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
            action      VARCHAR(128) NOT NULL,
            detail_json JSON,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id)")
    op.execute("CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC)")

    # ── bot_instances ─────────────────────────────────────────────
    op.execute("""
        CREATE TABLE bot_instances (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id           UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            status              VARCHAR(32) NOT NULL DEFAULT 'offline',
            last_heartbeat      TIMESTAMPTZ,
            error_message       TEXT,
            connected_at        TIMESTAMPTZ,
            stream_live         BOOLEAN NOT NULL DEFAULT FALSE,
            reconnect_attempts  INTEGER NOT NULL DEFAULT 0
        )
    """)

    # ── twitch_users ──────────────────────────────────────────────
    op.execute("""
        CREATE TABLE twitch_users (
            id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            twitch_id               VARCHAR(64) UNIQUE NOT NULL,
            current_username        VARCHAR(128) NOT NULL,
            username_history_json   JSON,
            avatar_url              TEXT,
            first_seen              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_seen               TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX idx_twitch_users_username ON twitch_users(current_username)")

    # ── tenant_user_exclusions ────────────────────────────────────
    op.execute("""
        CREATE TABLE tenant_user_exclusions (
            id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            twitch_user_id          VARCHAR(64) NOT NULL,
            exclude_chat_filter     BOOLEAN NOT NULL DEFAULT TRUE,
            exclude_name_filter     BOOLEAN NOT NULL DEFAULT TRUE,
            exclude_scan            BOOLEAN NOT NULL DEFAULT TRUE,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── global_user_exclusions ────────────────────────────────────
    op.execute("""
        CREATE TABLE global_user_exclusions (
            id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            twitch_user_id          VARCHAR(64) UNIQUE NOT NULL,
            exclude_chat_filter     BOOLEAN NOT NULL DEFAULT TRUE,
            exclude_name_filter     BOOLEAN NOT NULL DEFAULT TRUE,
            exclude_scan            BOOLEAN NOT NULL DEFAULT TRUE,
            set_by                  UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── notifications ─────────────────────────────────────────────
    op.execute("""
        CREATE TABLE notifications (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type        VARCHAR(64) NOT NULL,
            title       VARCHAR(256) NOT NULL,
            body        TEXT,
            read        BOOLEAN NOT NULL DEFAULT FALSE,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── chat_filters ──────────────────────────────────────────────
    op.execute("""
        CREATE TABLE chat_filters (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            name            VARCHAR(128) NOT NULL,
            enabled         BOOLEAN NOT NULL DEFAULT TRUE,
            case_sensitive  BOOLEAN NOT NULL DEFAULT FALSE,
            test_mode       BOOLEAN NOT NULL DEFAULT FALSE,
            priority        INTEGER NOT NULL DEFAULT 0,
            created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── chat_filter_terms ─────────────────────────────────────────
    op.execute("""
        CREATE TABLE chat_filter_terms (
            id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            filter_id               UUID NOT NULL REFERENCES chat_filters(id) ON DELETE CASCADE,
            term                    TEXT NOT NULL,
            is_regex                BOOLEAN NOT NULL DEFAULT FALSE,
            is_whitelist            BOOLEAN NOT NULL DEFAULT FALSE,
            similarity_threshold    FLOAT
        )
    """)

    # ── chat_filter_tiers ─────────────────────────────────────────
    op.execute("""
        CREATE TABLE chat_filter_tiers (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            filter_id           UUID NOT NULL REFERENCES chat_filters(id) ON DELETE CASCADE,
            tier_order          INTEGER NOT NULL,
            threshold           INTEGER NOT NULL DEFAULT 1,
            window_minutes      INTEGER NOT NULL DEFAULT 60,
            action              VARCHAR(32) NOT NULL DEFAULT 'timeout',
            duration_seconds    INTEGER NOT NULL DEFAULT 300,
            message_template    TEXT
        )
    """)

    # ── chat_filter_violations ────────────────────────────────────
    op.execute("""
        CREATE TABLE chat_filter_violations (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            filter_id       UUID NOT NULL REFERENCES chat_filters(id) ON DELETE CASCADE,
            twitch_user_id  VARCHAR(64) NOT NULL,
            tier_id         UUID REFERENCES chat_filter_tiers(id) ON DELETE SET NULL,
            count           INTEGER NOT NULL DEFAULT 1,
            window_start    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── chat_filter_hits ──────────────────────────────────────────
    op.execute("""
        CREATE TABLE chat_filter_hits (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            filter_id           UUID NOT NULL REFERENCES chat_filters(id) ON DELETE CASCADE,
            twitch_user_id      VARCHAR(64) NOT NULL,
            twitch_username     VARCHAR(128),
            message_text        TEXT,
            matched_term        TEXT,
            context_before_json JSON,
            context_after_json  JSON,
            test_mode           BOOLEAN NOT NULL DEFAULT FALSE,
            action_taken        VARCHAR(64),
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX idx_chat_filter_hits_filter_id ON chat_filter_hits(filter_id)")
    op.execute("CREATE INDEX idx_chat_filter_hits_created_at ON chat_filter_hits(created_at DESC)")

    # ── name_filters ──────────────────────────────────────────────
    op.execute("""
        CREATE TABLE name_filters (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            name        VARCHAR(128) NOT NULL,
            enabled     BOOLEAN NOT NULL DEFAULT TRUE,
            test_mode   BOOLEAN NOT NULL DEFAULT FALSE,
            priority    INTEGER NOT NULL DEFAULT 0,
            created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── name_filter_patterns ──────────────────────────────────────
    op.execute("""
        CREATE TABLE name_filter_patterns (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            filter_id       UUID NOT NULL REFERENCES name_filters(id) ON DELETE CASCADE,
            pattern         TEXT NOT NULL,
            is_regex        BOOLEAN NOT NULL DEFAULT FALSE,
            is_whitelist    BOOLEAN NOT NULL DEFAULT FALSE
        )
    """)

    # ── name_filter_tiers ─────────────────────────────────────────
    op.execute("""
        CREATE TABLE name_filter_tiers (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            filter_id           UUID NOT NULL REFERENCES name_filters(id) ON DELETE CASCADE,
            tier_order          INTEGER NOT NULL,
            threshold           INTEGER NOT NULL DEFAULT 1,
            window_minutes      INTEGER NOT NULL DEFAULT 1440,
            action              VARCHAR(32) NOT NULL DEFAULT 'ban',
            duration_seconds    INTEGER NOT NULL DEFAULT 0,
            message_template    TEXT
        )
    """)

    # ── bans ──────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE bans (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            twitch_user_id      VARCHAR(64) NOT NULL,
            twitch_username     VARCHAR(128),
            type                VARCHAR(32) NOT NULL DEFAULT 'permanent',
            duration_seconds    INTEGER,
            reason              TEXT,
            source              VARCHAR(64) NOT NULL DEFAULT 'manual',
            failover_protected  BOOLEAN NOT NULL DEFAULT FALSE,
            note                TEXT,
            created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX idx_bans_tenant_id ON bans(tenant_id)")
    op.execute("CREATE INDEX idx_bans_twitch_user_id ON bans(twitch_user_id)")

    # ── shared_ban_connections ────────────────────────────────────
    op.execute("""
        CREATE TABLE shared_ban_connections (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_a_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            tenant_b_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            status          VARCHAR(32) NOT NULL DEFAULT 'active',
            a_auto_ban      BOOLEAN NOT NULL DEFAULT TRUE,
            a_notify        BOOLEAN NOT NULL DEFAULT TRUE,
            a_share_permanent BOOLEAN NOT NULL DEFAULT TRUE,
            a_share_timeout BOOLEAN NOT NULL DEFAULT FALSE,
            b_auto_ban      BOOLEAN NOT NULL DEFAULT TRUE,
            b_notify        BOOLEAN NOT NULL DEFAULT TRUE,
            b_share_permanent BOOLEAN NOT NULL DEFAULT TRUE,
            b_share_timeout BOOLEAN NOT NULL DEFAULT FALSE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── ban_invitations ───────────────────────────────────────────
    op.execute("""
        CREATE TABLE ban_invitations (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            from_tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            to_tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            status          VARCHAR(32) NOT NULL DEFAULT 'pending',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            resolved_at     TIMESTAMPTZ
        )
    """)

    # ── batch_jobs ────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE batch_jobs (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id   UUID REFERENCES tenants(id) ON DELETE SET NULL,
            user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
            type        VARCHAR(64) NOT NULL,
            status      VARCHAR(32) NOT NULL DEFAULT 'pending',
            total       INTEGER NOT NULL DEFAULT 0,
            processed   INTEGER NOT NULL DEFAULT 0,
            failed      INTEGER NOT NULL DEFAULT 0,
            error_json  JSON,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            finished_at TIMESTAMPTZ
        )
    """)

    # ── chat_commands ─────────────────────────────────────────────
    op.execute("""
        CREATE TABLE chat_commands (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            command_name        VARCHAR(64) NOT NULL,
            permission_level    VARCHAR(32) NOT NULL DEFAULT 'everyone',
            global_cooldown_sec INTEGER NOT NULL DEFAULT 5,
            user_cooldown_sec   INTEGER NOT NULL DEFAULT 30,
            action_type         VARCHAR(32) NOT NULL DEFAULT 'response',
            response_template   TEXT,
            enabled             BOOLEAN NOT NULL DEFAULT TRUE,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── command_cooldown_tracking ─────────────────────────────────
    op.execute("""
        CREATE TABLE command_cooldown_tracking (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            command_id      UUID NOT NULL REFERENCES chat_commands(id) ON DELETE CASCADE,
            twitch_user_id  VARCHAR(64),
            last_used       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── name_scan_filters ─────────────────────────────────────────
    op.execute("""
        CREATE TABLE name_scan_filters (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name                VARCHAR(128) NOT NULL,
            description         TEXT,
            pattern_rules_json  JSON,
            whitelist_json      JSON,
            blacklist_json      JSON,
            trigger_action      VARCHAR(32) NOT NULL DEFAULT 'ban',
            trigger_message     TEXT,
            enabled             BOOLEAN NOT NULL DEFAULT TRUE,
            created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── name_scan_results ─────────────────────────────────────────
    op.execute("""
        CREATE TABLE name_scan_results (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            scan_filter_id  UUID NOT NULL REFERENCES name_scan_filters(id) ON DELETE CASCADE,
            twitch_user_id  VARCHAR(64) NOT NULL,
            twitch_username VARCHAR(128),
            found_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            banned_globally BOOLEAN NOT NULL DEFAULT FALSE
        )
    """)

    # ── name_scan_tenant_optins ───────────────────────────────────
    op.execute("""
        CREATE TABLE name_scan_tenant_optins (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            scan_filter_id  UUID NOT NULL REFERENCES name_scan_filters(id) ON DELETE CASCADE,
            tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            auto_ban        BOOLEAN NOT NULL DEFAULT FALSE,
            opted_in_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── filter_templates ──────────────────────────────────────────
    op.execute("""
        CREATE TABLE filter_templates (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name        VARCHAR(128) NOT NULL,
            type        VARCHAR(32) NOT NULL DEFAULT 'chat',
            config_json JSON,
            created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)


def downgrade() -> None:
    tables = [
        "filter_templates", "name_scan_tenant_optins", "name_scan_results",
        "name_scan_filters", "command_cooldown_tracking", "chat_commands",
        "batch_jobs", "ban_invitations", "shared_ban_connections", "bans",
        "name_filter_tiers", "name_filter_patterns", "name_filters",
        "chat_filter_hits", "chat_filter_violations", "chat_filter_tiers",
        "chat_filter_terms", "chat_filters", "notifications",
        "global_user_exclusions", "tenant_user_exclusions", "twitch_users",
        "bot_instances", "audit_logs", "tenant_moderators", "tenants",
        "legal_pages", "app_settings", "sessions", "users",
    ]
    for t in tables:
        op.execute(f"DROP TABLE IF EXISTS {t} CASCADE")
