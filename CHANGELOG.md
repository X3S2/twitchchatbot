# Changelog

Alle wesentlichen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).
Versionierung: `X.Y.Z` — X: nur auf Anweisung, Y: Major-Features, Z: Patches/Fixes

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
