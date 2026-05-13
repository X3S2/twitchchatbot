"""Add legal page content templates

Revision ID: 002
Revises: 001
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None

IMPRESSUM_DE = """<h2>Impressum</h2>
<p><strong>[NAME / FIRMA]</strong><br>
[STRASSE UND HAUSNUMMER]<br>
[PLZ ORT]<br>
Deutschland</p>

<p><strong>Kontakt:</strong><br>
E-Mail: <a href="mailto:[EMAIL]">[EMAIL]</a></p>

<p><strong>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV:</strong><br>
[NAME]<br>
[ANSCHRIFT WIE OBEN]</p>

<h3>Haftungsausschluss</h3>
<p>Die Inhalte dieser Plattform wurden mit größtmöglicher Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.</p>

<h3>Hinweis zu Twitch</h3>
<p>Diese Plattform ist ein unabhängiges Drittanbieter-Tool und steht in keiner Verbindung mit Twitch Interactive, Inc.</p>"""

IMPRESSUM_EN = """<h2>Legal Notice</h2>
<p><strong>[NAME / COMPANY]</strong><br>
[STREET AND NUMBER]<br>
[ZIP CITY]<br>
Germany</p>

<p><strong>Contact:</strong><br>
E-Mail: <a href="mailto:[EMAIL]">[EMAIL]</a></p>

<p><strong>Responsible for content pursuant to § 55 para. 2 RStV:</strong><br>
[NAME]<br>
[ADDRESS AS ABOVE]</p>

<h3>Disclaimer</h3>
<p>The content of this platform has been compiled with the greatest possible care. However, we cannot accept any liability for the accuracy, completeness or topicality of the content.</p>

<h3>Note on Twitch</h3>
<p>This platform is an independent third-party tool and is not affiliated with Twitch Interactive, Inc.</p>"""

DATENSCHUTZ_DE = """<h2>Datenschutzerklärung</h2>

<h3>1. Verantwortlicher</h3>
<p>Verantwortlicher im Sinne der DSGVO ist:<br>
<strong>[NAME / FIRMA]</strong><br>
[STRASSE UND HAUSNUMMER]<br>
[PLZ ORT]<br>
E-Mail: <a href="mailto:[EMAIL]">[EMAIL]</a></p>

<h3>2. Erhobene Daten</h3>
<p>Beim Einloggen über Twitch OAuth werden folgende Daten verarbeitet:</p>
<ul>
  <li>Twitch-Benutzername und Anzeigename</li>
  <li>Twitch-Benutzer-ID</li>
  <li>Profilbild-URL</li>
  <li>E-Mail-Adresse (sofern von Twitch übermittelt)</li>
</ul>

<h3>3. Zweck der Verarbeitung</h3>
<p>Die Daten werden ausschließlich zur Authentifizierung und Bereitstellung der Plattformfunktionen verwendet.</p>

<h3>4. Speicherdauer</h3>
<p>Daten werden gespeichert, solange ein aktives Konto besteht. Nach Löschung des Kontos werden personenbezogene Daten innerhalb von 30 Tagen entfernt.</p>

<h3>5. Weitergabe an Dritte</h3>
<p>Eine Weitergabe personenbezogener Daten an Dritte erfolgt nicht, außer dies ist zur Vertragserfüllung erforderlich oder gesetzlich vorgeschrieben.</p>

<h3>6. Ihre Rechte</h3>
<p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung Ihrer personenbezogenen Daten. Wenden Sie sich dazu an: <a href="mailto:[EMAIL]">[EMAIL]</a></p>

<h3>7. Cookies und Session</h3>
<p>Diese Plattform verwendet technisch notwendige Session-Cookies zur Authentifizierung. Es werden keine Tracking- oder Werbe-Cookies eingesetzt.</p>

<h3>8. Hinweis zu Twitch</h3>
<p>Diese Plattform nutzt die Twitch API. Es gelten zusätzlich die <a href="https://www.twitch.tv/p/de-de/legal/privacy-policy/" target="_blank" rel="noopener noreferrer">Datenschutzbestimmungen von Twitch</a>.</p>"""

DATENSCHUTZ_EN = """<h2>Privacy Policy</h2>

<h3>1. Data Controller</h3>
<p>The data controller within the meaning of the GDPR is:<br>
<strong>[NAME / COMPANY]</strong><br>
[STREET AND NUMBER]<br>
[ZIP CITY]<br>
E-Mail: <a href="mailto:[EMAIL]">[EMAIL]</a></p>

<h3>2. Data Collected</h3>
<p>When logging in via Twitch OAuth, the following data is processed:</p>
<ul>
  <li>Twitch username and display name</li>
  <li>Twitch user ID</li>
  <li>Profile picture URL</li>
  <li>Email address (if provided by Twitch)</li>
</ul>

<h3>3. Purpose of Processing</h3>
<p>Data is used exclusively for authentication and to provide platform features.</p>

<h3>4. Retention Period</h3>
<p>Data is stored as long as an active account exists. After account deletion, personal data is removed within 30 days.</p>

<h3>5. Third-Party Disclosure</h3>
<p>Personal data is not shared with third parties unless required for contract performance or legally mandated.</p>

<h3>6. Your Rights</h3>
<p>You have the right to access, correct, delete and restrict the processing of your personal data. Please contact: <a href="mailto:[EMAIL]">[EMAIL]</a></p>

<h3>7. Cookies and Sessions</h3>
<p>This platform uses technically necessary session cookies for authentication. No tracking or advertising cookies are used.</p>

<h3>8. Note on Twitch</h3>
<p>This platform uses the Twitch API. The <a href="https://www.twitch.tv/p/legal/privacy-policy/" target="_blank" rel="noopener noreferrer">Twitch Privacy Policy</a> additionally applies.</p>"""


def upgrade():
    op.execute(
        f"UPDATE legal_pages SET content_de = $${IMPRESSUM_DE}$$, content_en = $${IMPRESSUM_EN}$$ WHERE slug = 'impressum'"
    )
    op.execute(
        f"UPDATE legal_pages SET content_de = $${DATENSCHUTZ_DE}$$, content_en = $${DATENSCHUTZ_EN}$$ WHERE slug = 'datenschutz'"
    )


def downgrade():
    op.execute("UPDATE legal_pages SET content_de = '', content_en = '' WHERE slug IN ('impressum', 'datenschutz')")
