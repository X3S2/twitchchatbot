# Changelog

Alle wesentlichen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).
Versionierung: `X.Y.Z` — X: nur auf Anweisung, Y: Major-Features, Z: Patches/Fixes
Datum: Immer das aktuelle Datum wird beim Eintrag eingefügt.

---

## [0.22.15] — 2026-05-22 — In-App Bot-Token OAuth-Generator

### Neu
- **Bot-Token in-App generieren** — Neuer Button „Bot-Token generieren" in AdminSettings startet einen Twitch OAuth-Flow direkt aus der App heraus; der Admin loggt sich als Bot-Account ein und die generierten Tokens (access + refresh) werden sofort in der Datenbank gespeichert; da die Tokens dabei mit den eigenen App-Credentials erzeugt werden, funktioniert der automatische Refresh zuverlässig — das bisherige Problem mit twitchtokengenerator.com-Tokens (die an fremde App-Credentials gebunden waren) ist damit behoben
- **Twitchname automatisch befüllt** — Nach erfolgreichem OAuth wird der Bot-Accountname via Twitch-Validate-API ermittelt und im Feld `bot_username` gespeichert
- **Bot-OAuth Callback** — `GET /auth/callback` erkennt Bot-OAuth-States (`bot_` prefix) und delegiert an den neuen `_handle_bot_token_callback()` Helper; der User-Login-Flow läuft unverändert weiter
- **Erfolg/Fehler-Benachrichtigung** — Nach Rückkehr aus dem OAuth-Flow wird eine temporäre Benachrichtigung angezeigt (grün bei Erfolg, rot bei Fehler); die Seite aktualisiert sich automatisch

### Geändert
- **Token-Test-Button** — Zeigt jetzt auch bei nicht vorhandenem Token den OAuth-Button an; bei vorhandenem Token erscheinen Test- und OAuth-Button nebeneinander

---

## [0.22.14] — 2026-05-21 — Auge-Icon-Fix, Token-Refresh-Fehlermeldungen

### Behoben
- **Auge-Icon in Passwortfeldern nicht klickbar** — Eye/EyeOff-Toggle-Button wird jetzt nur dann angezeigt wenn das Feld einen eingetippten Wert enthält; da das Backend gespeicherte Secrets nie im Klartext zurücksendet (nur `*_set: bool`), gibt es nichts zum Einblenden solange kein neuer Wert eingegeben wird; betrifft Client Secret, Bot-Token und Bot-Refresh-Token in AdminSettings sowie Own-Bot-Token, Refresh-Token und Client Secret in TenantSettings
- **Token-Auto-Refresh: Fehlermeldungen unspezifisch** — Bei abgelaufenem Token wurde bisher „Token ungültig oder abgelaufen" ausgegeben ohne zu erklären warum der Auto-Refresh nicht klappte; jetzt gibt es spezifische Meldungen je nach Ursache: kein Refresh-Token gespeichert, fehlende App-Credentials (Client ID/Secret), oder Refresh-API-Fehler; außerdem zeigt der Erfolgsfall jetzt `(automatisch erneuert)` in der Bestätigungsmeldung und gibt `refreshed: true` in der API-Antwort zurück; gilt für Admin-`test-bot-token` und Tenant-`test-bot-token`

---

## [0.22.13] — 2026-05-21 — i18n Help-Boxen, Bot-Status-Live-Update, Token-Auto-Refresh, Chart-Cursor-Fix

### Neu
- **i18n Help-Boxen** — Alle 12 Help/Info-Boxen der App sind jetzt vollständig internationalisiert (DE + EN); Inhalte in `de.json`/`en.json` unter neuem `"help"`-Abschnitt; Seiten-Komponenten verwenden `t()` + `dangerouslySetInnerHTML` für HTML-Inhalte (sicher — statische Bundle-Strings)

### Geändert
- **Bot-Status nach Pending sofort aktualisieren** — Nach Ablauf des 3s-Pending-Timers wird der React-Query-Cache (`['bot-status', id]` bzw. `['admin-instances']`) sofort invalidiert; dadurch wird der echte Bot-Status ohne Wartezeit angezeigt; Admin-Panel: Stale-Closure-Bug im WebSocket-Handler behoben (verwendet jetzt `rowPendingRef` statt State)
- **Token-Auto-Refresh bei Test** — `POST /test-bot-token` (Admin + Tenant) versucht bei abgelaufenem oder ungültigem Token jetzt automatisch einen Refresh via `refresh_user_token()` (neue Funktion in `twitch_client.py`); neue Tokens werden in DB gespeichert; nur wenn Refresh fehlschlägt wird Fehler zurückgegeben
- **Chart-Cursor deaktiviert** — `cursor={false}` ersetzt das bisherige `cursor={{ fill: 'rgba(...)' }}` im Stats-Chart; entfernt die lila Hover-Füllfläche die über den gestrichelten Rand ragte

### Behoben
- **README Entwicklungsstatus Reihenfolge** — v0.22.11 und v0.22.12 waren in falscher Reihenfolge eingetragen; korrigiert auf aufsteigende Versionsreihenfolge

---

## [0.22.12] — 2026-05-20 — Pending-Mindestdauer, Stream-LED, Token-Ablauf, Chart-Cursor-Fix

### Geändert
- **Pending-Mindestdauer 3s** — Bot-Start/Stop-Pending-Zustand (gelber Button) bleibt jetzt mind. 3 Sekunden sichtbar; verhindert kurzes Aufblitzen + Button ist während Pending nicht anklickbar; WebSocket-Statusupdates werden während des Pending-Zustands ignoriert (TenantDashboard + Admin-Panel)
- **Admin-Panel: Stream-Spalte mit LED** — Statt einfachem Strich wird jetzt eine rote pulsierende LED + „LIVE" angezeigt wenn der Kanal streamt, und eine graue LED + „Offline" wenn nicht
- **Token-Ablaufanzeige** — Token-Test-Ergebnis zeigt jetzt lesbare Ablaufzeit: `0h` → `abgelaufen` (bei `expires_in=0`), `< 1h` → Minuten (z.B. `42min`), `≥ 1h` → Stunden (z.B. `12h`); Backend gibt bei `expires_in=0` direkt `ok: False` zurück (AdminSettings + TenantSettings + backend admin/tenants router)
- **Chart-Cursor-Fix** — Hover-Cursor der Balkendiagramme (lila Füllfläche) ragt nicht mehr über den gestrichelten Chart-Rahmen hinaus; `ResponsiveContainer` ist in `overflow-hidden`-div eingebettet

---

## [0.22.11] — 2026-05-15 — Pending-Buttons, Impressum-Fix, Token-Test, NameScan-Create, Tooltip-Fix

### Neu
- **Bot-Start/Stop: Pending-Zustand (gelber Button)** — Während der Bot gestartet oder gestoppt wird, erscheint ein gelber, deaktivierter Button mit Lade-Spinner anstelle des grünen/roten Buttons — sowohl im TenantDashboard als auch im Admin-Panel (pro Zeile); verhindert Doppelklick-Aktionen
- **OAuth-Token-Test-Buttons** — Neuer „Bot-Token testen"-Button in den Admin-Einstellungen (Shared-Bot-Bereich) und in den Tenant-Einstellungen (Eigener Bot); ruft `POST /api/admin/test-bot-token` bzw. `POST /api/tenants/{id}/test-bot-token` auf und zeigt Twitch-Login + Ablaufzeit an
- **NameScan: Filter erstellen & bearbeiten** — Der `+Scan-Filter erstellen`-Button öffnet jetzt ein Modal mit Formular (Name, Beschreibung, Aktion: flag/warn/ban/log, Aktiv-Checkbox); Stift-Button öffnet Edit-Modal; beide senden an `POST /api/name-scan/filters` bzw. `PUT /api/name-scan/filters/{id}`

### Geändert
- **Impressum: HTML-Paragraph-Abstände** — `prose`-Klasse (benötigt `@tailwindcss/typography`) ersetzt durch explizite Tailwind-Arbitrary-CSS-Varianten (`[&_p]:mb-4`, `[&_h2]:...`) — Absätze, Überschriften und Listen im Impressum-/Datenschutz-HTML sind jetzt korrekt gesetzt
- **Recharts Tooltip-Position** — `allowEscapeViewBox` auf `{ x: false, y: false }` zurückgesetzt (Standard-Recharts-Clamping-Verhalten); `wrapperStyle={{ zIndex: 50 }}` hinzugefügt — Tooltip bleibt im Chart-Bereich

---

## [0.22.10] — 2026-05-14 — Twitch Refresh-Token, Auth-Fehlerbehandlung, Bot-Stop-DB-Fix, Docker-Build-Fix

### Neu
- **Twitch Refresh-Token-Unterstützung** — Neues DB-Feld `bot_refresh_token_enc` (AppSettings) und `own_bot_refresh_token_enc` (Tenant); neues Alembic-Migration 003; Admin-Einstellungen und Tenant-Einstellungen haben je ein „Refresh Token"-Feld; Bot-Manager nutzt den Refresh-Token automatisch wenn das Access-Token abläuft
- **Automatische Token-Erneuerung im Bot** — Wenn der TwitchIO-Bot-Task mit einem Auth-Fehler endet, ruft `BotInstance._try_token_refresh()` die Twitch OAuth-API auf, speichert die neuen Tokens im Backend und startet den Bot neu; erfordert dass Client-Secret und Refresh-Token konfiguriert sind
- **`event_error`-Handler im Bot** — `TwitchBotInstance.event_error()` fängt TwitchIO-interne Fehler ab und meldet `status=error` an den Backend-Heartbeat-Endpoint
- **`POST /internal/token-update`-Endpoint** — Neuer interner API-Endpoint damit der Bot-Manager nach einem Token-Refresh die neuen Tokens verschlüsselt im Backend speichern kann
- **Bot-Stop setzt DB-Status direkt** — `stop_bot()`-Endpoint setzt `BotInstance.status = "offline"` direkt in der DB (statt nur den Bot-Manager anzurufen und zu hoffen); behebt Problem dass Status nach Container-Neustart als "online" hängen blieb

### Geändert
- **Intern: Config-Response um `client_secret`, `bot_refresh_token`** — `GET /internal/tenant/{id}/config` liefert jetzt auch `client_secret` und `bot_refresh_token` damit der Bot-Manager Token-Refresh ohne extra DB-Zugriff durchführen kann
- **Stats: Tooltip-Fix** — `left: 10` statt `left: 0` als Margin; `allowEscapeViewBox={{ x: true, y: true }}` damit der Tooltip nicht im SVG-Bereich gefangen ist

### Hinweis
- Alle Änderungen aus v0.22.9 (HelpModals, Template-Variablen-Hilfe, LegalEditor-Vorlagen, BotStop-Fehleranzeige) waren aufgrund eines Docker-Build-Cache-Problems nicht deployed; wurden mit diesem Release nachgezogen (Rebuild mit `--build`-Flag)

---

## [0.22.9] — 2026-05-15 — BotStop-Fehleranzeige, HelpModals komplett, Template-Variablen-Hilfe, Stats-Tooltip-Fix, Legal-Vorlagen

### Geändert
- **TenantDashboard: Bot-Stop-Fehleranzeige** — `stopBot()`-Fehler werden jetzt über `setBotError` angezeigt statt still ignoriert (`.catch(() => {})`); Error-Box strukturell aus dem Flex-Container herausgelöst (eigene Zeile statt drittes Flex-Item)
- **Stats: Tooltip-Position** — `<BarChart>` erhält `margin={{ top: 5, right: 20, bottom: 5, left: 0 }}`; `<Tooltip>` erhält `allowEscapeViewBox={{ x: false, y: true }}` um seitliches Herausrutschen zu verhindern
- **Commands: Template-Variablen-Hilfe** — Aufklappbares Hilfe-Panel neben dem „Antwort-Template"-Label zeigt verfügbare Platzhalter: `{user}` (Aufrufer) und `{args}` (Parameter)

### Neu
- **HelpModals auf fehlenden Seiten** — Aufklappbare Hilfe-Panels mit ⓘ-Button auf: Geteilte Bans, Namensscan (Tenant), Moderatoren, Admin-Übersicht, Admin-Einstellungen, Admin-Namensscan, Tenant-Freigabe, Nutzerverwaltung
- **LegalEditor: Vorlagen** — „Vorlage einfügen"-Button neben den HTML-Textareas befüllt die Felder mit strukturierten HTML-Vorlagen für Impressum (DE/EN) und Datenschutzerklärung (DE/EN)

---

## [0.22.8] — 2026-05-14 — InfoModals, BanList-Fix, Stats-Tooltip, Commands-Erweiterung, HelpModals

### Neu
- **InfoModal NameFilters: Muster-Erklärung** — HelpCircle-Button neben dem „Muster"-Header im Edit-Panel öffnet ein umfassendes Info-Panel mit Erklärung zu Wildcard (`*`, `?`), Teilstring-Match (kein Wildcard) und Regex-Modus, inkl. Beispieltabelle (spam*, *bot, *toxic*, raid → was trifft was)
- **InfoModal ChatFilters: Begriff-Erklärung** — HelpCircle-Button neben dem „Begriffe"-Header erklärt Wildcard/Teilstring/Regex für Nachrichten, Whitelist-Begriff-Logik, Groß-/Kleinschreibung und Zeitrahmen-Funktion
- **Commands: Neue Aktionstypen** — `bot_stop`, `bot_restart`, `unban_user`, `test_mode_toggle` hinzugefügt zu ACTION_TYPES und ACTION_INFO (mit Beschreibungen)
- **Commands: Syntax-Preview-Panel** — Unter dem Aktionstyp-Dropdown wird dynamisch ein einzeiliges Syntax-Beispiel zum gewählten Aktionstyp angezeigt
- **Bot-Backend: `_execute_command_action()`** — Neues `bot_instance.py`-Methode führt spezielle Aktionstypen (bot_stop, bot_restart, unban_user, test_mode_toggle) bei Befehls-Trigger aus
- **Seitenweite HelpModals** — Aufklappbare Hilfe-Panels auf: TenantList, TenantSettings, BanList, Commands

### Geändert
- **BanList: Username-First-Formular** — `twitch_username` ist jetzt das primäre Eingabefeld (groß, autoFocus); User-ID wurde in einen „Erweitert"-Aufklapper verschoben
- **BanList: `duration_seconds` bei Timeout** — Wenn Typ „Timeout" gewählt, erscheint ein Zahlen-Eingabefeld für die Dauer in Sekunden (Standard: 600)
- **Stats: Reaktiver Dark-Mode-Cursor** — Chart-Tooltip-Cursor reagiert nun korrekt auf Theme-Wechsel via MutationObserver statt einmaligem `classList.contains` beim Render; Cursor-Fill auf dezentes Lila (`rgba(139,92,246,0.08)`) statt grauem Recharts-Standard

### Behoben
- **NameFilters: Encoding-Bug `â†'`** — Das direkte Unicode-Zeichen `→` in der TSX-Quelle führte zu Mojibake in der kompilierten Ausgabe. Ersetzt durch Lucide `<ArrowRight />` Icon

---

## [0.22.7] — 2026-05-14 — nginx OAuth-Callback Query-String Fix

### Behoben
- **Login: "Fehler" / 422 nach Twitch-Redirect** — Root Cause: nginx verhält sich bei `proxy_pass $variable/uri/path` anders als bei einem literalen Wert. Wenn eine Variable verwendet wird, übergibt nginx den URI-Pfad aus `proxy_pass` **ohne** den Query-String des Originalrequests. Dadurch wurden `?code=...&state=...` (von Twitch zurückgeliefert) beim Callback gestripped — die API sah eine leere Anfrage und antwortete mit 422. Fix: `rewrite ^/auth/callback(.*)$ /api/auth/callback$1 break;` + `proxy_pass $api_upstream;` (ohne Pfad) — so übergibt nginx den vollen Request-URI inkl. Query-String korrekt.

---

## [0.22.6] — 2026-05-14 — nginx DNS-Resolver Fix

### Behoben
- **nginx: stale upstream IP nach Container-Restart** — nginx löste `tcb-api` einmalig beim Start auf und cachte die IP dauerhaft. Nach einem API-Neustart (neue Docker-IP) lieferte nginx 502 für alle `/api/`-Requests ("Connection refused" zur alten IP). Fix: `resolver 127.0.0.11 valid=30s ipv6=off;` + `set $api_upstream http://tcb-api:8000;` in nginx.conf — erzwingt regelmäßiges Re-Resolving über den Docker-internen DNS.

---

## [0.22.5] — 2026-05-14 — NameFilter Dauer-Anzeige-Fix, README Entwicklungsstatus

### Behoben
- **NameFilters: Dauer-Feld in Leseansicht auch bei Warn/Ban sichtbar** — In der aufgeklappten Leseansicht eines Name-Filters zeigte `{tier.duration_seconds > 0}` die Sekundenzahl auch bei `warn` und `ban`. Guard auf `tier.action === 'timeout'` korrigiert (war in der Bearbeitungsansicht bereits korrekt).
- **Warn-Aktion-Badge in NameFilters-Leseansicht fehlte** — `warn`-Tiers wurden in gelb statt blau dargestellt (gleiche Farbe wie `timeout`). Jetzt: `warn` → blau, `timeout` → gelb, `ban` → rot — konsistent mit ChatFilters.
- **README Entwicklungsstatus unvollständig** — Tabelle endete bei v0.19. Ergänzt um v0.20 bis v0.22.4 mit kurzen Inhaltsbeschreibungen.

---

## [0.22.4] — 2026-05-14 — Zeitfenster-Filter, Dashboard-Fix, Whitelist-Hervorhebung, Commands-Info

### Neu
- **Chat-Filter: Prüf-Zeitrahmen (Zeitfenster)** — Jeder Chat-Filter hat jetzt eine "Prüf-Zeitrahmen"-Einstellung auf Filter-Ebene (nicht pro Stufe). Optionen: Immer, 1/5/15/30/60/120 min. Der Bot zählt nur Verstöße innerhalb dieses Zeitfensters – ältere Einträge werden ignoriert. Das Zeitfenster gilt für alle Stufen desselben Filters.
- **Bot-Filter: echtes zeitfenster-basiertes Violation-Tracking** — `filter_engine.py` und `bot_instance.py` nutzen jetzt Timestamps statt einfacher Zähler. Verstöße außerhalb des `window_minutes`-Fensters werden beim Auslösen ignoriert.
- **Namens-Filter: Whitelist-Einträge visuell hervorheben** — Im erweiterten Leseansicht der Name-Filter werden Whitelist-Muster jetzt grün mit einem Häkchen (✓) dargestellt – identisch zur Chat-Filter-Ansicht.
- **Befehle: Info-Modal für Aktionstypen** — Neben dem Aktion-Dropdown gibt es jetzt einen Info-Button (ℹ), der ein Erklärungs-Modal öffnet: Was macht `respond`, `ban`, `timeout`, `delete`?

### Behoben
- **Dashboard: "Du hast noch keine Channels konfiguriert"** — Das Haupt-Dashboard zeigte immer die Leer-Meldung, auch wenn Channels konfiguriert waren. Jetzt werden Tenants abgefragt: bei einem Channel wird direkt zur Tenant-Übersicht weitergeleitet, bei mehreren zu `/tenants`. Nur bei echten Null-Channels erscheint die Meldung mit direktem Link zum Hinzufügen.
- **Bot-Fehler bleibt nach erfolgreichem Start sichtbar** — Wenn der Bot nach einem Fehler-Status erfolgreich startete, blieb `error_message` in der DB stehen (Heartbeat-Update überschrieb es nur bei neuem Fehler). Jetzt wird `error_message` beim Heartbeat immer gesetzt – `None` bei Erfolg löscht den alten Fehler.
- **Trigger-Stufen: Dauer-Feld für Warn und Ban ausgeblendet** — "Für X Sekunden" erscheint jetzt nur noch bei der Aktion `timeout`. Warn und Ban brauchen keine Dauer.

---

## [0.22.3] — 2026-05-14 — Bot-Token-Key-Mismatch, Admin-Panel-Feedback, Warning-Scope

### Neu
- **README: `moderator:manage:warnings` Scope** — In der Bot-OAuth-Token-Anleitung ergänzt.

### Behoben
- **Bot startet nicht ("Kein Bot-Token konfiguriert")** — Root Cause: `BotInstance.start()` und `TwitchBotInstance._resolve_token()` suchten nach `"shared_bot_token"` im Config-Dict, aber `internal.py` lieferte den Schlüssel als `"bot_token"`. Fix: Schlüssel korrigiert + `"bot_mode"` in die Config-Antwort aufgenommen.
- **Admin-Panel: Start/Stop ohne Fehler-Feedback** — `startBot()`/`stopBot()` in `AdminIndex.tsx` ignorierten `res.ok` und zeigten bei Fehler nichts an. Jetzt wirft jede Funktion bei HTTP-Fehler, `onError` zeigt die Fehlermeldung inline pro Tabellenzeile.
- **Admin-Panel: "Bot starten" auch bei Status `error`** — Identischer Fix wie in TenantDashboard (v0.22.1).

---


### Neu
- **README: Bot OAuth-Token Anleitung** — Schritt-für-Schritt-Erklärung wie man den Bot-Token über twitchtokengenerator.com generiert, welche Scopes benötigt werden, und wo der Token eingetragen wird (Setup-Wizard oder Admin → Einstellungen).

### Behoben
- **Setup-Wizard: keine Weiterleitung nach Ersteinrichtung** — Nach erfolgreichem Abschicken des Setup-Formulars blieb man auf `/setup` stehen. Jetzt erfolgt nach 1,5 Sekunden automatisch eine Weiterleitung zu `/login`.

---

## [0.22.1] — Filter-Nachrichtentext, Encoding-Fix, Bot-Fehleranzeige

### Neu
- **Filter-Tiers: Chat-Nachricht konfigurierbar** — Jede Stufe (warn/timeout/ban) hat jetzt ein Eingabefeld „Chat-Nachricht nach Aktion". Der Bot sendet diesen Text nach der Aktion in den Chat; `{user}` wird durch den Benutzernamen ersetzt. Das Feld war bisher im Backend und Bot-Manager vorhanden, aber nicht in der UI zugänglich.

### Behoben
- **NameFilters: Encoding-Fehler in Quellcode** — Sonderzeichen `·` (Mittelpunkt), `…` (Ellipsis) und `→` (Pfeil) wurden als `Â·`, `â€¦`, `â†'` dargestellt (UTF-8/Latin-1-Mojibake in NameFilters.tsx). Direkt im Quellcode korrigiert.
- **name_filters.py API-Antwort unvollständig** — `GET /filters/name` serialisierte die Tier-Daten ohne `message_template` → gespeicherte Nachrichten wurden beim Öffnen des Editierformulars nicht angezeigt.
- **Bot starten: kein Feedback bei Fehler** — Klick auf „Bot starten" zeigte keine Fehlermeldung wenn das Backend 400 zurückgab (z. B. kein Bot-Token konfiguriert). Jetzt erscheint der Fehlertext direkt unter dem Button.
- **Bot starten: auch bei Status `error` sichtbar** — „Bot starten"-Button ist jetzt auch dann sichtbar, wenn der Status auf `error` steht (vorher nur bei `offline`).

---

## [0.22.0] — Dark-Mode-Dropdowns, Auth-Session, Stats-Tooltip, Bot-Token-Validierung

### Behoben
- **Dark Mode: `<select>`-Elemente** — `bg-transparent` führte in dark-mode zu weißem Hintergrund mit weißem Text (unsichtbar). Betroffene Dateien: `ChatFilters.tsx`, `NameFilters.tsx`, `TenantSettings.tsx`, `Commands.tsx`, `MultiTwitchBanner.tsx`. Fix: explizites `bg-white dark:bg-gray-800 dark:text-gray-100`.
- **Stats-Seite: Tooltip-Overlay** — Recharts `<Tooltip />` hatte weißen Hintergrund ohne dark-mode-Styling (erschien als überlagerndes weißes Feld). Fix: `contentStyle` prop mit dynamischer Farbauswahl (hell/dunkel je nach `<html class="dark">`). `CartesianGrid`-Linienfarbe ebenfalls theme-abhängig.
- **Auth-Session „Halb-ausgeloggt"** — Access-Token (15 min) lief ab, aber TanStack-Query-Cache (`staleTime: 5min`) lieferte noch `isAuthenticated=true`. API-Calls schlugen lautlos mit 401 fehl. Fixes: (1) `fetchMe` versucht jetzt automatisch `POST /api/auth/refresh` bei 401, bevor der Fehler geworfen wird; (2) `staleTime` auf 1 min reduziert; (3) `refetchInterval: 10min` — hält Token aktiv (vor 15-min-Ablauf). 
- **Filter-Toggle 401 stumme Fehler** — `toggleFilter` in `ChatFilters` und `NameFilters` prüfte `res.ok` nicht → 401-Fehler wurden verschluckt, Toggle wirkte scheinbar erfolgreich. Fix: `res.ok`-Check und `throw new Error(status)`. `toggleMut` invalidiert jetzt bei 401 die Auth-Query → startet automatischen Refresh-Versuch.
- **Bot: leeres Token → kein klarer Fehler** — Wenn kein Shared-Bot-Token konfiguriert war, startete die TwitchIO-Instanz kommentarlos und hing ohne je `event_ready` zu feuern. Bot-Manager meldet jetzt `status=error` mit Meldung „Kein Bot-Token konfiguriert", wenn nach Config-Load kein Token vorhanden ist.
- **Bot-Start: fehlender Token-Check im Backend** — `POST /tenants/{id}/bot/start` prüfte nicht, ob ein Bot-Token in den App-Settings (shared mode) oder Tenant-Settings (own mode) eingetragen ist. Endpoint gibt jetzt `400` mit klarer Fehlermeldung zurück, bevor Bot-Manager kontaktiert wird.

---

## [0.21.0] — Filter-Bearbeitung, Kanal-Verwaltung, Legal-Editor

### Neu
- **ChatFilters**: Inline-Edit-Panel — Pencil-Button öffnet Bearbeitungsformular direkt unter dem Filter-Header; Terms (Begriff, Regex, Whitelist) und Tiers (Schwellenwert, Aktion, Dauer) können inline hinzugefügt, bearbeitet und entfernt werden; PUT-Endpoint wird aufgerufen
- **NameFilters**: Gleiches Inline-Edit-Panel wie ChatFilters; arbeitet mit `patterns` (statt `terms`) und ohne `case_sensitive`-Feld
- **TenantApproval**: Zeigt jetzt zwei Sektionen — „Ausstehend" (mit Freigeben/Ablehnen) und „Freigegeben" (mit Freigabe-entziehen-Button); bisher wurden nur nicht-freigegebene Kanäle angezeigt
- **Backend revoke-Endpoint**: `POST /api/tenants/{id}/revoke` — setzt `approved=False` ohne den Tenant zu löschen
- **LegalEditor**: Neue Admin-Seite `/admin/legal` zum Bearbeiten von Impressum und Datenschutz (Titel DE/EN, HTML-Inhalt DE/EN); PATCH-Endpoint im Backend
- **Legal-Migration 002**: Alembic-Migration füllt `content_de` und `content_en` für beide Legal-Seiten mit deutschen/englischen HTML-Vorlagen ([PLATZHALTER] für Betreiberdaten)
- **AppLayout**: Sidebar-Header auf `h-14` (56px) fixiert — passt jetzt zur Höhe des Haupt-Headers; Sidebar-Footer auf `h-10` (40px) fixiert — passt zur Fußzeile des Hauptbereichs
- **Admin-Navigation**: „Rechtliche Seiten"-Link (`/admin/legal`) in der Admin-Sidebar ergänzt

### Geändert
- `backend/app/routers/legal.py`: `PATCH /{slug}`-Endpoint mit `require_admin`-Absicherung hinzugefügt
- i18n (DE/EN): Neue Keys `filters.enabled`, `filters.add_term/add_pattern/add_tier`, `filters.tiers_hint`, `filters.no_terms/no_patterns/no_tiers`, `filters.duplicate`; `admin.revoke/approved/no_approved`; `admin.legal_*`; `tenant.channel/requested_at`; Top-Level `saved`

---

## [0.20.0] — UI-Bugfixes nach erstem Login

### Behoben
- **nginx**: `charset utf-8;` ergänzt — behebt Zeichendarstellungsfehler (â€¢ statt •) in Firefox
- **AdminSettings.tsx**: Hardcodierte Platzhalter-Zeichen `â€¢` → `•`, `âœ"` → `✓`, `âœ—` → `✗` korrigiert (falsche Latin-1-Codierung in der Quelldatei)
- **Audit-Log**: Backend-Endpoint `/api/tenants/{id}/audit` gab ein flaches Array zurück; Frontend erwartet `{items, total}` — nun korrekte Struktur inkl. `actor_username` (JOIN auf Users-Tabelle), `detail` (statt `detail_json`) und Unterstützung des `action`-Filterparameters
- **ChatFilters**: „+ Filter erstellen"-Button hatte keinen `onClick`-Handler — Inline-Formular mit Name-Feld und API-Anbindung (`POST /filters/chat`) hinzugefügt
- **NameFilters**: Gleicher Fix wie ChatFilters für `POST /filters/name`
- **TenantModerators**: Rollen-Mismatch korrigiert (`moderator`/`manager` → `viewer`/`editor`, passend zum Backend); Username-Suche in lokaler DB mit Autocomplete-Dropdown hinzugefügt; Twitch-ID wird automatisch befüllt wenn User gefunden

---

## [0.19.0] — Docker-Bugfixes, erster funktionaler Stack-Start

### Behoben
- `docker-compose.yml`:
  - `tcb-botmanager`: env-Var `API_INTERNAL_URL` → korrekter Name `API_URL` (passend zu `bot-manager/app/config.py`)
  - `tcb-botmanager`: fehlender `INTERNAL_API_KEY` env-Var ergänzt
  - `tcb-api`: fehlender `INTERNAL_API_KEY` env-Var ergänzt
  - `tcb-nginx`: Config-Mount von `conf.d/default.conf` → `nginx.conf` (vollständige nginx.conf mit `events`-Block)
- `nginx/nginx.conf`: `worker_processes auto;` war fälschlicherweise innerhalb von `events {}` — in den main-Context verschoben; `events {}` hat nun `worker_connections 1024`
- `bot-manager/app/config.py`: Standard-Hostname `tcb-backend` → korrekter Containername `tcb-api`
- `bot-manager/Dockerfile`: `curl` installiert (für HEALTHCHECK benötigt)
- `frontend/Dockerfile.build`: Neues Build-only Image für Volume-Befüllung (`/output`)
- `frontend/src/App.tsx`: Import-Pfade `'../'` → `'./'` (Datei liegt in `src/`, nicht in `src/src/`)
- `frontend/src/layouts/AppLayout.tsx`: Doppelter `export default function AppLayout` entfernt (altes Duplikat)
- `frontend/src/pages/tenants/TenantSettings.tsx`: Doppelter `export default function TenantSettings` entfernt
- `frontend/src/pages/TwitchUserSearch.tsx`: Doppelter `export default function TwitchUserSearch` entfernt
- `frontend/src/pages/admin/AdminSettings.tsx`: Zweifaches Duplikat entfernt (3 → 1 Implementierung)
- Diverse ungenutzte TypeScript-Imports entfernt (`useState`, `useMutation`, `useQueryClient`, `Trash2`, `Plus`, `BotStatus`)
- `backend/app/routers/bans.py`: Python-Syntaxfehler — Default-Parameter vor Non-Default-Parametern in `delete_ban`, `bulk_unban`, `export_bans` korrigiert
- `frontend/src/pages/Dashboard.tsx`: Import-Pfad `'../../hooks/useAuth'` → `'../hooks/useAuth'`

### Hinzugefügt
- `.env` (lokal, nicht in Git): Erstes lokales Test-Set mit generierten Schlüsseln
- `frontend/package-lock.json`: Generiert für reproduzierbare Docker-Builds

---

## [0.18.0] — README-Bereinigung, NameScan-Navigation, !tcbrejoin

### Hinzugefügt
- `frontend/src/layouts/AppLayout.tsx` — Nav-Link `Name-Scan` (→ `tenants/:id/name-scan`) in der Tenant-Sidebar
- `bot-manager/app/bot_instance.py`:
  - `!tcbrejoin` Befehl für Mods/Broadcaster — lässt den Bot den Kanal verlassen und sofort wieder beitreten
  - Neue Methode `_cmd_rejoin()` mit Rückstatus-Meldung an Backend
- `frontend/src/i18n/de.json` + `en.json` — `nav.name_scan` Key

### Geändert
- `README.md` — duplizierten Block (alter Stand v0.7.0) entfernt; nur noch ein sauberer, aktueller Inhalt

---

## [0.17.0] — Name-Scan Bulk-Apply, Tenant-NameScan-Seite

### Hinzugefügt
- `backend/app/routers/name_scan.py`:
  - `POST /name-scan/tenants/{tenant_id}/filters/{filter_id}/apply-all` — bannt alle noch nicht gebannten User aus einem Scan-Filter auf einmal (doppelte Bestätigung im Frontend)
- `frontend/src/pages/tenants/NameScan.tsx` (NEU):
  - Übersicht aktiver Opt-ins mit "Alle jetzt bannen"-Button
  - Zweistufige Bestätigung (Text + Checkbox) vor Massen-Ban
  - Opt-in/Opt-out für verfügbare Scan-Filter
  - Ergebnisanzeige nach dem Bulk-Ban
- `frontend/src/App.tsx` — Route `tenants/:id/name-scan` registriert
- `frontend/src/i18n/de.json` + `en.json` — `name_scan`-Namespace hinzugefügt

---

## [0.16.0] — Bot-Commands !tcbinfo, !tcbstats, !tcbstop, !tcbstart

### Hinzugefügt
- `bot-manager/app/bot_instance.py`:
  - `!tcbinfo [term]` — zeigt aktive Filter-Infos oder sucht einen Filterbegriff (Mods)
  - `!tcbstats` — zeigt Filter-Trefferstatistik der aktuellen Session (Mods)
  - `!tcbstop` / `!tcbstart` — pausiert/reaktiviert den Bot im Kanal (nur Broadcaster)
  - Neue Hilfsmethoden: `_cmd_tcbinfo`, `_cmd_tcbstats`, `_cmd_bot_pause`
- `backend/app/routers/internal.py`:
  - `POST /internal/bot-pause` mit `{tenant_id, paused}` — aktualisiert Bot-Status + Redis-Event
  - Neues Pydantic-Model `BotPauseRequest`

---

## [0.15.0] — Twitch-User-Datenbank Ausschlüsse, TwitchUserSearch Erweiterung

### Hinzugefügt
- `backend/app/routers/twitch_users.py` — Neue Endpoints:
  - `POST /{twitch_id}/exclude` — Tenant- oder global User von Filtern ausschließen
  - `GET /{twitch_id}/exclusions` — Vorhandene Ausschlüsse abrufen
- `frontend/src/pages/TwitchUserSearch.tsx` — Ausschluss-Panel für Admins: globaler Ausschluss mit einem Klick, Anzeige von bestehenden Ausschlüssen
- `frontend/src/i18n/de.json` + `en.json` — neue Keys: `exclusions`, `globally_excluded`, `exclude_global_all`, `excluded_tenants`

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
