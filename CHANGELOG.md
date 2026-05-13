# Changelog

Alle wesentlichen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).
Versionierung: `X.Y.Z` — X: nur auf Anweisung, Y: Major-Features, Z: Patches/Fixes

---

## [0.14.0] — SharedBans API-Alignment, Einladungssystem vollständig

### Hinzugefügt
- `backend/app/routers/bans.py` — Neue Endpoints passend zum Frontend:
  - `GET /bans/shared` — Verbindungen mit `partner_channel_name`
  - `DELETE /bans/shared/{id}` — Verbindung einseitig auflösen
  - `GET /bans/invitations` — Eingehende Einladungen (pending)
  - `POST /bans/invitations` — Einladung per Kanalname senden (`target_channel_name`)
  - `POST /bans/invitations/{id}/accept` — Einladung annehmen
  - `POST /bans/invitations/{id}/reject` — Einladung ablehnen
  - Legacy-Alias `GET /bans/shared/connections` für Rückwärtskompatibilität

---

## [0.13.0] — AdminSettings Test-Credentials Button, Code-Cleanup

### Hinzugefügt
- `frontend/src/pages/admin/AdminSettings.tsx` — "Credentials testen"-Button: prüft gespeicherte App-Credentials live gegen Twitch-API und zeigt Token-Ablaufzeit an
- `frontend/src/i18n/de.json` + `en.json` — neue Keys: `test_credentials`, `testing`, `credentials_ok`, `credentials_fail`

### Geändert/Korrigiert
- `frontend/src/pages/admin/AdminSettings.tsx` — duplizierten Legacy-Code entfernt (alter Komponentenentwurf war versehentlich am Ende der Datei verblieben)

---

## [0.12.0] — Token-Validierung, Twitch-User-ID-Lookup, Test-Credentials

### Hinzugefügt
- `backend/app/core/twitch_client.py` — Neue Funktion `validate_token()`: validiert Twitch-Access-Token via `/oauth2/validate`
- `backend/app/routers/admin.py` — `POST /api/admin/test-credentials`: prüft gespeicherte App-Credentials auf Gültigkeit (gibt Scopes + Ablaufzeit zurück)
- `backend/app/routers/multi_ban.py` — Echte Twitch-User-ID-Auflösung via `lookup_twitch_user()` bei Multi-Ban (Best-Effort, Fallback auf "unknown")

---

## [0.11.0] — Failover-Schutz, Unban-Benachrichtigung, Bot !unban-Befehl

### Hinzugefügt
- `backend/app/routers/internal.py` — `POST /api/internal/unban-notification`: Bot meldet manuelle Entbannung → setzt `failover_protected=True` für alle Bans des Users im Tenant
- `bot-manager/app/bot_instance.py` — Erkennung von Twitch-`!unban`-Befehlen durch Mods/Broadcaster: sendet automatisch Unban-Benachrichtigung an Backend
- `bot-manager/app/bot_instance.py` — Hilfsfunktion `is_broadcaster()` für Kanal-Owner-Erkennung

### Geändert
- `backend/app/routers/bans.py` — `DELETE /{ban_id}?add_to_whitelist=true` setzt `failover_protected=True` statt physischem Löschen (verhindert Auto-Reban)

---

## [0.10.0] — Twitch-Moderator-Check, Twitch-Client, Failover-Schutz

### Hinzugefügt
- `backend/app/core/twitch_client.py` — Neue Twitch Helix API Hilfsbibliothek: App-Access-Token (Client-Credentials), Moderatoren-Liste abrufen, User-Lookup
- `backend/app/tasks/__init__.py` + `backend/app/tasks/mod_check.py` — Background-Task: alle 5 Minuten Twitch-Moderationsrechte aller Tenants prüfen; bei verlorenem Mod-Recht `revoked_at` setzen + Benachrichtigung an Streamer
- `backend/app/routers/admin.py` — `POST /api/admin/mod-check` Endpoint zum manuellen Auslösen des Moderator-Checks
- `backend/app/main.py` — `mod_check_loop()` als asyncio.Task beim App-Start

### Geändert/Korrigiert
- `backend/app/routers/bans.py` — `DELETE /{ban_id}?add_to_whitelist=true`: Setzt `failover_protected=True` statt zu löschen → verhindert erneutes automatisches Bannen durch Filter
- `backend/app/main.py` — Shutdown-Logik für mehrere Background-Tasks generalisiert

---

## [0.9.0] — Multi-Ban Backend, README-Aktualisierung

### Hinzugefügt
- `backend/app/routers/multi_ban.py` — Neuer `POST /api/multi-ban` Endpoint: bannt einen User auf einem Kanal; prüft Editor-Rechte, verhindert Selbst-Ban, legt Ban-Eintrag mit `source=multi_banner` an
- `backend/app/main.py` — `multi_ban` Router registriert

### Geändert
- `README.md` — Vollständige Aktualisierung: Version auf v0.8.0, Entwicklungsstatus-Tabelle auf alle Phasen abgeschlossen, Architektur-Diagramm erweitert (WebSocket-Rooms, Router-Tabelle), Sicherheits-Abschnitt, Synology-NAS-Anleitung, wichtige `.env`-Variablen

---

## [0.8.0] — API-Fixes, Tenant-Sub-Navigation, TwitchUser-Suche, Multi-Banner

### Hinzugefügt
- `frontend/src/pages/TwitchUserSearch.tsx` — Twitch-User-Suche mit Debounce, Avatar, Erstellt/Zuletzt-gesehen, Ban-Verlauf (Admin)
- `frontend/src/pages/MultiTwitchBanner.tsx` — Massen-Ban-Tool: Ziel-User, Grund (Auswahl + frei), Kanal-Liste, Bestätigungs-Checkbox, Echtzeit-Ergebnis je Kanal
- `frontend/src/layouts/AppLayout.tsx` — Kontextsensitive Sidebar: Tenant-Sub-Navigation (Dashboard, Chat-Filter, Namens-Filter, Bans, Geteilte Bans, Befehle, Statistiken, Moderatoren, Einstellungen, Audit), Admin-Sub-Navigation, aktiver NavItem-Highlight
- `frontend/src/App.tsx` — Neue Routen `/users/search` und `/multi-ban` hinzugefügt
- `frontend/src/i18n/de.json` + `en.json` — Neue Schlüssel: `nav.*` (tenant_section, filters_chat, filters_name, shared_bans, user_search, multi_ban), `settings.already_set`, `settings.token_placeholder`, `settings.new_mod_default_role`, `admin.credentials_hint`, `admin.global_retention_days`, `users.*`, `mtb.*`

### Geändert/Korrigiert
- `frontend/src/pages/admin/AdminSettings.tsx` — Vollständig überarbeitet: Nutzt korrekte API-Shape (`client_id_set: bool`, `bot_token_set: bool` statt Klartext-Credentials); masked-credential Pattern identisch zu TenantSettings; `require_approval` entfernt (kein Backend-Feld); `global_retention_days` hinzugefügt
- `frontend/src/pages/tenants/TenantSettings.tsx` — Überarbeitet: Split in `TenantSettingsData` (API-Response mit masked Booleans) und `TenantSettingsForm` (Formular, Credential-Felder leer); leere Credential-Felder werden vor PATCH entfernt; grüner CheckCircle-Hinweis bei gesetztem Wert

---

## [0.7.0] — Name-Scan & Admin-Verwaltung (Frontend)

### Hinzugefügt
- `frontend/src/pages/admin/AdminSettings.tsx` — App-weite Einstellungen (Twitch Client-ID/Secret, Shared-Bot-Credentials, Maintenance-Mode, Freigabepflicht)
- `frontend/src/pages/admin/NameScan.tsx` — Name-Scan-Filter verwalten (Aktivieren/Deaktivieren, Löschen)
- `frontend/src/i18n/de.json` + `en.json` — Vollständige Erweiterung aller UI-Schlüssel (notifications, tenant, bot, stats, bans, filters, commands, mods, audit, settings, admin, user, pagination)
- `frontend/src/App.tsx` — Alle Routen eingebunden: tenants, tenant-subpages, admin, admin-subpages
- Topbar-Navigation erweitert mit Benachrichtigungsglocke und Tenant-Menüeintrag

---

## [0.6.0] — Befehle & Statistiken (Frontend)

### Hinzugefügt
- `frontend/src/pages/tenants/commands/Commands.tsx` — Bot-Befehl-Verwaltung: Liste, Erstellen, Bearbeiten, Löschen; Permission-Level-Badges; Cooldown-Konfiguration
- `frontend/src/pages/tenants/Stats.tsx` — Statistik-Dashboard mit Recharts BarChart (Bans/Timeouts pro Tag), Perioden-Auswahl (Tag/Woche/Monat), Top-Filter, Top-Begriffe, Totals-Kacheln

---

## [0.5.0] — Ban-System UI (Frontend)

### Hinzugefügt
- `frontend/src/pages/tenants/bans/BanList.tsx` — Ban-Liste: Suche, Typ-Filter, Multi-Select für Bulk-Unban, Ban hinzufügen, CSV-Export
- `frontend/src/pages/tenants/bans/SharedBans.tsx` — Geteilte Bans: Verbindungsliste, Einladungen senden/empfangen (annehmen/ablehnen), Verbindung trennen

---

## [0.4.0] — Chat-Filter & Name-Filter UI (Frontend)

### Hinzugefügt
- `frontend/src/pages/tenants/filters/ChatFilters.tsx` — Chat-Filter-Verwaltung: Expandierbare Karten mit Begriffsliste (Regex/Whitelist-Badge) und Tier-Übersicht; Toggle, Duplizieren, Löschen
- `frontend/src/pages/tenants/filters/NameFilters.tsx` — Namens-Filter-Verwaltung: analog zu Chat-Filtern mit Pattern-Liste und Tier-Konfiguration

---

## [0.3.0] — Tenant-Dashboard & Moderationssystem (Frontend)

### Hinzugefügt
- `frontend/src/pages/tenants/TenantList.tsx` — Kachelübersicht eigener Kanäle mit LED-Status, LIVE-Badge, Freigabe-Badge, Kanal-Erstellen-Formular
- `frontend/src/pages/tenants/TenantDashboard.tsx` — Kanal-Dashboard: Bot-Status (LED + WebSocket-Live-Updates), Stats-Kacheln (Bans/Timeouts/Filter-Hits), Schnellnavigation
- `frontend/src/pages/tenants/TenantSettings.tsx` — Kanal-Einstellungen: bot_mode, Zugangsdaten (Show/Hide), Stream-Awareness, Retention, Reconnect-Konfiguration
- `frontend/src/pages/tenants/TenantModerators.tsx` — Moderatoren-Verwaltung: Liste, Hinzufügen (Role-Select), Entfernen
- `frontend/src/pages/tenants/AuditLog.tsx` — Paginator-fähiges Audit-Log mit Aktionsfilter
- `frontend/src/hooks/useWebSocket.ts` — WebSocket-Hook mit Auto-Reconnect (3 Sek.)
- `frontend/src/hooks/useNotifications.ts` — TanStack-Query-Hooks für Benachrichtigungen
- `frontend/src/components/NotificationBell.tsx` — Glocken-Icon mit Unread-Badge und Dropdown
- `frontend/src/components/LED.tsx` — Status-Indikator-Komponente (online/offline/connecting/error)
- `frontend/src/components/InfoButton.tsx` — Tooltip-Hilfskomponente
- Admin-Seiten: `Index.tsx` (Bot-Instanzen), `TenantApproval.tsx`, `UserManagement.tsx`

---

## [0.2.0] — Backend-API-Vollständigkeit + TwitchIO-Bot

### Hinzugefügt
- `backend/app/models/` — vollständige SQLAlchemy-Modelle für alle Phasen: `Tenant`, `BotInstance`, `TenantModerator`, `AuditLog`, `ChatFilter`, `ChatFilterTerm`, `ChatFilterTier`, `ChatFilterViolation`, `ChatFilterHit`, `NameFilter`, `NameFilterPattern`, `NameFilterTier`, `Ban`, `SharedBanConnection`, `BanInvitation`, `BatchJob`, `TwitchUser`, `TenantUserExclusion`, `GlobalUserExclusion`, `ChatCommand`, `CommandCooldownTracking`, `NameScanFilter`, `NameScanResult`, `NameScanTenantOptin`, `FilterTemplate`
- `backend/app/routers/ws.py` — WebSocket-Endpunkte (`/ws/admin`, `/ws/tenant/{id}`) mit Redis Pub/Sub Integration und `WsManager`-Klasse
- `backend/app/routers/internal.py` — interne API für Bot-Manager (`/internal/heartbeat`, `/internal/filter-hit`, `/internal/tenant/{id}/config`) mit Bearer-Token-Auth
- `backend/app/routers/notifications.py` — vollständige Notifications-API (GET, Unread-Count, als gelesen markieren, löschen)
- `backend/app/routers/tenants.py` — vollständige Tenant-API: CRUD, Admin-Genehmigung, Bot-Steuerung, Moderatoren, Audit-Log, Widgets, Datenexport, Admin-Instanzübersicht
- `backend/app/routers/chat_filters.py` — vollständige Chat-Filter-API: Filter CRUD, Terms, Tiers, Hits-Log, Duplikation
- `backend/app/routers/name_filters.py` — vollständige Name-Filter-API analog zu chat_filters
- `backend/app/routers/bans.py` — vollständige Bans-API: CRUD, Export (JSON/CSV), Import-Vorschau + Bestätigung, Bulk-Unban, Shared-Bans, Einladungen
- `backend/app/routers/jobs.py` — Batch-Job-Status-API
- `backend/app/routers/commands.py` — vollständige Chat-Command-API mit eingebauten TCB-Befehlen
- `backend/app/routers/stats.py` — Statistiken-API (Bans/Timeouts pro Tag, Top-Filter, Top-Terms, Totals)
- `backend/app/routers/name_scan.py` — Name-Scan-Filter CRUD, Ergebnisse, Tenant-Opt-Ins
- `backend/app/routers/twitch_users.py` — Twitch-User-Suche, Username-History, Cross-Tenant-Ban-History
- `backend/app/core/config.py` — Neues Feld `internal_api_key` für Bot-Manager-Kommunikation
- `backend/app/main.py` — Alle neuen Router eingebunden; `redis_subscriber()` als asyncio-Background-Task im Lifespan; Version auf 0.2.0
- `backend/alembic/env.py` — Alle neuen Modelle importiert für Autogenerate
- `bot-manager/app/config.py` — Pydantic Settings für `api_url`, `internal_api_key`, `redis_url`
- `bot-manager/app/redis_bus.py` — Redis Pub/Sub Publisher-Helper
- `bot-manager/app/bot_instance.py` — Vollständige TwitchIO 2.x Bot-Instanz mit Chat-Filter, Name-Filter, Commands, Heartbeat (30s), Config-Refresh (5min)
- `bot-manager/app/filter_engine.py` — Chat-Filter-Engine: Keyword, Wildcard, Regex, Ähnlichkeit (difflib), Whitelist, Tier-Auswahl
- `bot-manager/app/name_filter_engine.py` — Name-Filter-Engine analog
- `bot-manager/app/command_handler.py` — Command-Handler mit Permission-Level, Cooldowns, eingebauten TCB-Befehlen
- `bot-manager/app/main.py` — Beim Start: Redis verbinden, aktive Tenants laden und Bot-Instanzen starten; Version auf 0.2.0
- `.env.example` — Neues Feld `INTERNAL_API_KEY`

---

## [0.1.1] — 13.05.2026 17:00 Uhr

### Hinzugefügt
- `backend/app/models/` — SQLAlchemy 2.0-Modelle: `User`, `AppSettings`, `LegalPage`, `Notification`, `Session`
- `backend/app/routers/auth.py` — vollständiger Twitch-OAuth-Flow mit Token-Rotation, HttpOnly-Cookies, SameSite=Strict
- `backend/app/routers/admin.py` — Setup-Wizard-Endpunkte, App-Settings CRUD, Legal-Pages CRUD, User-Management (ban/unban/kick), Profil-Einstellungen
- `backend/app/routers/legal.py` — öffentliche Legal-Pages-API
- `backend/app/main.py` — FastAPI-App mit Lifespan, Maintenance-Middleware, allen Routern, SlowAPI-Rate-Limiting
- `backend/alembic.ini` + `backend/alembic/env.py` — Async-Alembic-Konfiguration mit autogenerate-Unterstützung
- `frontend/` — vollständiges React 18 + Vite 5 + TypeScript 5 + Tailwind CSS 3 Frontend-Scaffold
  - `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`
  - `index.html`, `src/main.tsx`, `src/App.tsx`
  - Routen: `/setup`, `/login`, `/`, `/admin`, `/legal/:slug`
  - Layout: `AppLayout.tsx` mit responsiver Sidebar (Icons auf Mobile, Text auf Desktop)
  - Komponenten: `ThemeToggle`, `LangToggle`, `CookieBanner`, `ProtectedRoute`
  - Hooks: `useAuth`, `useTheme`
  - Seiten: `Setup`, `Login`, `Dashboard`, `LegalPage`
  - i18n: DE + EN JSON-Sprachpakete
  - Dockerfile (multi-stage), nginx.frontend.conf
- `frontend/public/favicon.svg` — Bot-Icon SVG (lila, Roboter-Design)
- `bot-manager/` — Microservice-Skeleton (FastAPI + TwitchIO-Stub)
  - `Dockerfile`, `requirements.txt`
  - `app/main.py` — `/health`, `/instances`, `/instances/start`, `/instances/stop`
  - `app/instance_manager.py` — Instance-Pool-Management
  - `app/bot_instance.py` — einzelne Bot-Instanz (Stub, Phase 2: echter IRC)
- `nginx/nginx.conf` — Reverse-Proxy-Konfiguration mit SPA-Fallback, API-Proxy, WebSocket-Support, Security-Headers

---

## [0.1.0] — 13.05.2026 15:21 Uhr

### Hinzugefügt
- Projektstruktur initialisiert (Phase 1: Foundation)
- `docker-compose.yml` mit allen 5 Services: `tcb-nginx`, `tcb-api`, `tcb-botmanager`, `tcb-postgres`, `tcb-redis`
- `.env.example` mit kommentierter Konfiguration (Port, DB, JWT, Fernet)
- `.gitignore` (plan/-Ordner lokal ausgeschlossen)
- `README.md` mit Projektbeschreibung, Schnellstart und Architekturübersicht
- `CHANGELOG.md` initialisiert
- PostgreSQL 16 Full-Schema (`init.sql`) mit allen Kerntabellen
- Alembic-Setup für spätere Datenbankmigrationen
- FastAPI-Backend-Skeleton:
  - CORS-Konfiguration
  - `/health`-Endpunkt
  - JWT-Authentifizierung (15min Access Token + Refresh-Token-Rotation)
  - Twitch-OAuth-Flow (`/auth/login`, `/auth/callback`, `/auth/me`, `/auth/logout`)
  - Rate-Limiting (Redis-backed)
  - Fernet-Verschlüsselung für sensitive DB-Felder
- React/Vite/TypeScript-Frontend-Scaffold:
  - Tailwind CSS 4 + shadcn/ui
  - React Router 6 + TanStack Query 5
  - i18next mit DE/EN-Sprachpaketen
  - Dark/Light-Modus (System-Default, Toggle mit Sonne/Mond-Icon, DB-Persistenz)
  - Sprachumschalter DE/EN (DB-Persistenz)
  - Cookie-Banner (DSGVO)
- `favicon.svg` (Bot-Icon)
- Setup-Wizard (`/setup`): einmalige Konfiguration mit Client-ID/Secret, erster Twitch-Login = Admin
- DSGVO-Seiten: `/impressum`, `/datenschutz` (Inhalte via Admin-Panel editierbar)
- Zeitzone-Einstellung pro User (Standard: Europe/Berlin, mit Echtzeit-Uhrzeit-Vorschau)
- Maintenance-Modus-Toggle im Admin-Panel
- Responsives Layout mit Mobil-Icons
- Bot-Manager-Skeleton (TwitchIO-Instanzpool, Basis-Struktur)
- nginx-Konfiguration

---
