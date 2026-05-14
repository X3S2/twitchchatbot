<div align="center">
  <img src="frontend/public/favicon.svg" alt="TwitchChatBot Logo" width="80" />
  <h1>TwitchChatBot (TCB)</h1>
  <p>Mandantenfähige Twitch-Chat-Moderationsplattform</p>

  ![Version](https://img.shields.io/badge/version-0.22.5-blue)
  ![License](https://img.shields.io/badge/license-private-red)
  ![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker)
  ![Python](https://img.shields.io/badge/python-3.12-3776AB?logo=python)
  ![React](https://img.shields.io/badge/react-18-61DAFB?logo=react)
</div>

---

## Überblick

**TwitchChatBot (TCB)** ist eine selbst gehostete, mandantenfähige Plattform zur automatisierten Moderation von Twitch-Chats. Jeder Streamer erhält eine eigene isolierte IRC-Bot-Instanz mit individuellen Filtern, Bannlisten und einem vollständigen Dashboard. Moderatoren können mit kontrollierten Rechten auf die Einstellungen zugreifen.

<details>
<summary><strong>Funktionsübersicht</strong></summary>

### Kernfunktionen

| Funktion | Beschreibung |
|---|---|
| **Chat-Text-Filter** | Keyword-Filter mit Wildcards, gestaffelten Strafen (Warn/Timeout/Ban) und konfigurierbaren Zeitfenstern |
| **Twitch-Name-Filter** | Automatische Erkennung verdächtiger Usernamen nach Pattern (Wildcard/Regex) |
| **Lokale Bannliste** | Pro Tenant, mit Import/Export (JSON/CSV), Batch-Ban, Notizfeldern |
| **Geteilte Bannlisten** | Opt-in-Sharing zwischen Streamern mit konfigurierbarer Auto-Ban-Propagation |
| **MultiTwitchBanner** | Gleichzeitiges Bannen eines Users auf mehreren Channels mit Bestätigungs-Dialog |
| **Name-Scan-Funktion** | Proaktives Scannen nach Usernamen-Mustern (Admin-Funktion) |
| **Twitch-User-Suche** | Suche nach Twitch-Nutzern mit vollständigem Ban-Verlauf über alle Kanäle |
| **Chat-Befehle** | Konfigurierbare IRC-Befehle mit Permission-Level und Cooldown |
| **Mandantentrennung** | Vollständige Isolation; kein Tenant sieht Daten eines anderen |
| **Audit-Log** | Vollständige Nachvollziehbarkeit aller Moderationsaktionen |

### Plattform-Features

| Feature | Beschreibung |
|---|---|
| **Modernes UI** | React + Tailwind CSS, Dark/Light-Modus, DE/EN-Sprachumschaltung |
| **Kontextsensitive Sidebar** | Dynamische Navigation je nach Kontext (Tenant, Admin, Übersicht) |
| **Mobil-optimiert** | Vollständig responsiv für Smartphone und Tablet |
| **Echtzeit** | WebSocket-basiertes Live-Dashboard und Activity-Feed via Redis Pub/Sub |
| **Admin-Panel** | Globale Verwaltung aller Tenants, Instanzen und App-Einstellungen |
| **DSGVO-konform** | Cookie-Banner, Impressum, Datenschutz (Inhalte im Admin editierbar) |
| **Sicherheit** | Fernet-verschlüsselte Credentials, HttpOnly JWT-Cookies, Internal-API-Key |

</details>

<details>
<summary><strong>Systemanforderungen & Installation</strong></summary>

### Voraussetzungen

- Docker & Docker Compose
- Git
- Twitch-Entwicklerkonto (https://dev.twitch.tv) für Client-ID/Secret
- Eigener Twitch-Bot-Account (optional, sonst mit eigenem Account)

### Schnellstart

```bash
# 1. Repository klonen
git clone https://github.com/X3S2/twitchchatbot.git
cd twitchchatbot

# 2. Umgebungsvariablen einrichten
cp .env.example .env
# .env öffnen und Werte eintragen (Passwörter, JWT_SECRET_KEY, FERNET_KEY)

# 3. Container starten
docker compose up -d

# 4. Im Browser öffnen
# http://localhost:3080/setup
# Ersten Admin-Account über Twitch-Login anlegen
```

### Fernet-Schlüssel generieren

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Port konfigurieren

In `.env`:
```env
TCB_EXTERNAL_PORT=3080
```

### Synology NAS (DSM 7+)

1. Docker-Paket im Package Center installieren
2. SSH aktivieren, Repository in ein Docker-Volume klonen
3. `docker compose up -d` ausführen
4. Firewall-Regel für Port 3080 erstellen
5. Optionales Reverse-Proxy im DSM-Control-Panel konfigurieren (HTTPS)

</details>

<details>
<summary><strong>Architektur</strong></summary>

```
Browser ──► tcb-nginx (Port 3080)
               ├── /          ──► React Frontend (Vite Build)
               └── /api/      ──► FastAPI Backend (tcb-api :8000)
                                       ├── WebSocket /ws/admin
                                       ├── WebSocket /ws/tenant/{id}
                                       ├── REST API /api/**
                                       ├── Internal /api/internal/** ──► tcb-botmanager
                                       ├── DB   ──► tcb-postgres :5432
                                       └── Cache ──► tcb-redis :6379
                                                        └── Pub/Sub: tcb:admin, tcb:tenants
```

| Container | Technologie | Funktion |
|---|---|---|
| `tcb-nginx` | nginx 1.27 | Reverse Proxy + Static Files |
| `tcb-api` | Python 3.12 + FastAPI 0.115 | REST API + WebSocket + Auth |
| `tcb-botmanager` | Python 3.12 + TwitchIO 2.10 | IRC-Instanzmanager |
| `tcb-postgres` | PostgreSQL 16 | Primärdatenbank (SQLAlchemy 2.0) |
| `tcb-redis` | Redis 7 | Cache + Pub/Sub Kommunikation |

### Backend Router-Übersicht

| Router | Pfad-Prefix | Funktion |
|---|---|---|
| `admin.py` | `/api/admin` | Setup-Wizard, App-Einstellungen, Legal-Seiten |
| `tenants.py` | `/api/tenants` | Tenant-CRUD, Settings, Bot-Control, Mods, Audit |
| `chat_filters.py` | `/api/tenants/{id}/filters/chat` | Chat-Filter CRUD + Treffer |
| `name_filters.py` | `/api/tenants/{id}/filters/name` | Namens-Filter CRUD + Treffer |
| `bans.py` | `/api/tenants/{id}/bans` | Bans CRUD, Bulk, Export, Sharing |
| `commands.py` | `/api/tenants/{id}/commands` | Bot-Befehle CRUD |
| `stats.py` | `/api/tenants/{id}/stats` | Statistiken mit Zeitraum-Filter |
| `jobs.py` | `/api/tenants/{id}/jobs` | Hintergrundaufgaben-Status |
| `name_scan.py` | `/api/name-scan` | Admin-seitige Name-Scan-Filter |
| `twitch_users.py` | `/api/twitch-users` | User-Suche + Ban-Verlauf |
| `notifications.py` | `/api/notifications` | Benachrichtigungen |
| `ws.py` | `/ws` | WebSocket (admin + tenant rooms) |
| `internal.py` | `/api/internal` | Bot-Manager Callback (API-Key gesichert) |

</details>

<details>
<summary><strong>Konfiguration</strong></summary>

### Twitch-App einrichten

1. https://dev.twitch.tv/console aufrufen
2. "Register Your Application" klicken
3. OAuth Redirect URL: `http://localhost:3080/auth/callback` (oder deine öffentliche URL)
4. Client-ID und Client-Secret notieren
5. Im Setup-Wizard auf `/setup` eintragen

### Bot OAuth-Token generieren

Der Bot braucht einen eigenen OAuth-Token, mit dem er sich bei Twitch authentifiziert und dem Chat beitreten kann.

**Schritt-für-Schritt:**

1. Mit dem **Bot-Account** (z. B. ChatiBotii) bei Twitch einloggen — *nicht mit dem Haupt-Account*
2. https://twitchtokengenerator.com aufrufen
3. **„Bot Chat Token"** auswählen
4. Diese Scopes aktivieren:
   - `chat:read`
   - `chat:edit`
   - `channel:moderate`
   - `moderator:manage:banned_users`
   - `moderator:manage:warnings`
5. „Generate Token!" klicken und bei Twitch autorisieren
6. Den angezeigten **Access Token** kopieren — *(Prefix `oauth:` weglassen, falls vorhanden)*

**Token eintragen:**
- Beim **Setup-Wizard** (`/setup`): optionales Feld „Bot OAuth-Token (optional)" — empfohlen für die Ersteinrichtung
- Oder nachträglich unter **Admin → Einstellungen → Shared Bot → Bot OAuth-Token**

> Token verfällt nach 60 Tagen Inaktivität oder bei Passwortänderung des Bot-Accounts. In diesem Fall einfach neu generieren und eintragen.

### Wichtige .env-Variablen

```env
# Datenbank
POSTGRES_PASSWORD=sicheres_passwort
POSTGRES_DB=tcb_db

# Sicherheit
JWT_SECRET_KEY=min_32_zeichen_zufaellig
FERNET_KEY=fernet_schluessel_base64

# Bot-Manager
INTERNAL_API_KEY=interner_api_schluessel

# Port (Standard: 3080)
TCB_EXTERNAL_PORT=3080

# Öffentliche URL (für Twitch OAuth)
APP_PUBLIC_URL=https://deine-domain.de
```

### Credential-Sicherheit

- Alle OAuth-Tokens und Secrets werden mit **Fernet (AES-256)** verschlüsselt in der Datenbank gespeichert
- Das Frontend zeigt **niemals** Klartext-Credentials — nur `already_set: bool` Indikator
- Die interne API (`/api/internal/*`) ist nur im Docker-Netzwerk erreichbar und erfordert `INTERNAL_API_KEY`
- JWT-Tokens werden als **HttpOnly-Cookies** gesetzt (kein JavaScript-Zugriff)

### Eigene Domain / ipv64.net

1. `APP_PUBLIC_URL` in `.env` auf die öffentliche URL setzen
2. Twitch-App-Redirect-URI entsprechend aktualisieren
3. nginx-Konfiguration bei Bedarf anpassen

</details>

---

## Entwicklungsstatus

| Phase | Version | Status | Inhalt |
|---|---|---|---|
| Foundation | `v0.1.1` | ✅ Fertig | Docker, Auth, Setup, Dark/Light, i18n, DSGVO |
| Backend Core | `v0.2.0` | ✅ Fertig | Alle DB-Models, alle Router, Bot-Manager + TwitchIO |
| Tenant-System | `v0.3.0` | ✅ Fertig | Dashboard, TenantSettings, Moderatoren, AuditLog, WS-Hooks |
| Filter UI | `v0.4.0` | ✅ Fertig | Chat-Filter, Namens-Filter mit Tiers/Begriffen |
| Ban-System UI | `v0.5.0` | ✅ Fertig | BanList, SharedBans, Import/Export, Bulk-Ban |
| Befehle & Stats | `v0.6.0` | ✅ Fertig | Chat-Befehle CRUD, Statistik-Dashboard |
| Admin UI | `v0.7.0` | ✅ Fertig | AdminSettings, NameScan, alle Routen, i18n komplett |
| API-Fixes & Navigation | `v0.8.0` | ✅ Fertig | API-Shape-Korrekturen, Tenant-Sub-Nav, UserSearch, MultiBanner |
| Multi-Ban Backend | `v0.9.0` | ✅ Fertig | `/api/multi-ban` Endpoint, README-Aktualisierung |
| Mod-Check & Failover | `v0.10.0` | ✅ Fertig | Twitch-Mod-Check Background-Task, Twitch-Client, Failover-Schutz |
| Unban-Schutz & Bot-Befehle | `v0.11.0` | ✅ Fertig | !unban-Erkennung im Bot, Unban-Notification-Endpoint, Failover-Protected-Flag |
| Token-Validierung & User-Lookup | `v0.12.0` | ✅ Fertig | validate_token(), test-credentials Endpoint, echte Twitch-User-ID bei Multi-Ban |
| AdminSettings Test-Credentials | `v0.13.0` | ✅ Fertig | Test-Button in AdminSettings, Code-Cleanup, i18n-Erweiterung |
| SharedBans API-Alignment | `v0.14.0` | ✅ Fertig | Vollständiges Einladungssystem, Frontend-Backend-API-Abgleich |
| TwitchUser-Ausschlüsse | `v0.15.0` | ✅ Fertig | Globaler/Tenant-Ausschluss, Admin-UI in TwitchUserSearch |
| Bot-Commands !tcbinfo/!tcbstats/!tcbstop/!tcbstart | `v0.16.0` | ✅ Fertig | Vollständige Chat-Befehle für Mods und Broadcaster |
| Name-Scan Bulk-Apply | `v0.17.0` | ✅ Fertig | Massen-Ban aus NameScan-Filter mit doppelter Bestätigung |
| README-Bereinigung & !tcbrejoin | `v0.18.0` | ✅ Fertig | NameScan-Nav, !tcbrejoin-Befehl, README-Duplikat entfernt |
| Docker-Bugfixes & erster Stack-Start | `v0.19.0` | ✅ Fertig | Env-Vars, nginx.conf, TS-Duplikate, Python-Syntax, Healthcheck |
| UI-Bugfixes nach erstem Login | `v0.20.0` | ✅ Fertig | nginx charset, Audit-Log Shape, ChatFilter/NameFilter Create, TenantMods Rollen-Fix |
| Filter-Bearbeitung, Kanalverwaltung, Legal-Editor | `v0.21.0` | ✅ Fertig | Inline-Edit für Chat/Name-Filter, TenantApproval Revoke, Legal-Editor (Admin), Migrations |
| Dark-Mode, Auth-Session, Bot-Token-Validierung | `v0.22.0` | ✅ Fertig | Dark-Mode Dropdowns, Auto-Token-Refresh, Filter-Toggle 401-Fix, Bot-Token-Pflichtprüfung |
| Filter-Nachrichten, Encoding-Fix, Bot-Fehleranzeige | `v0.22.1` | ✅ Fertig | Tier-Nachrichten in UI, UTF-8-Mojibake-Fix, Bot-Startfehler-Feedback |
| Setup-Weiterleitung, README Bot-Token-Doku | `v0.22.2` | ✅ Fertig | Redirect nach Setup, Bot-OAuth-Token Schritt-für-Schritt-Anleitung |
| Bot-Token-Key-Fix, Admin-Panel-Feedback, Warning-Scope | `v0.22.3` | ✅ Fertig | Kritischer `bot_token`-Key-Fix (Bot startet wieder), Admin Start/Stop Fehlermeldung |
| Zeitfenster-Filter, Dashboard-Fix, UI-Verbesserungen | `v0.22.4` | ✅ Fertig | Prüf-Zeitrahmen pro Chat-Filter, Dashboard-Weiterleitung, Whitelist-Hervorhebung, Commands Info-Modal |
| NameFilter Dauer-Fix, README-Update | `v0.22.5` | ✅ Fertig | NameFilters Leseansicht Dauer/Farbe korrigiert, README Entwicklungsstatus ergänzt |

---

## Changelog

Siehe [CHANGELOG.md](CHANGELOG.md)

---

<div align="center">
  <sub>Privates Projekt — Nicht öffentlich zugänglich</sub>
</div>
