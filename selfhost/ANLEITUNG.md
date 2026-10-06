# EPP auf eigenem Supabase + VPS betreiben

## 1. Datenbank einrichten
1. Supabase öffnen → **SQL Editor** → New query.
2. Inhalt von `selfhost/schema.sql` komplett einfügen → **Run**.
   (Legt alle Tabellen, Funktionen, Zugriffsregeln, Speicher-Buckets und den Registrierungs-Trigger an.)
3. **Authentication → Providers → Email** aktivieren.
4. **Authentication → URL Configuration**: Site URL = Ihre Domain (bzw. Preview-URL), Redirect URLs ergänzen.

## 2. Ersten Admin anlegen
1. **Authentication → Users → Add user** (E-Mail + Passwort, "Auto confirm").
2. Im SQL Editor:
```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'IHRE@EMAIL.de';
```

## 3. Serverfunktionen (Edge Functions) deployen
```bash
npm i -g supabase
supabase login
supabase link --project-ref quhkqiznwatvjxgdzzpy
supabase functions deploy --no-verify-jwt   # nutzt supabase/functions/*
```
Hinweis: `supabase/config.toml` enthält noch die alte Projekt-ID – in der ersten Zeile `project_id = "quhkqiznwatvjxgdzzpy"` setzen.

## 4. Geheime Schlüssel setzen
```bash
supabase secrets set \
  RESEND_API_KEY=... TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... \
  AZURE_CLIENT_ID=... AZURE_CLIENT_SECRET=... AZURE_TENANT_ID=... \
  ANOSIM_API_KEY=... MCP_API_KEY=... FIRECRAWL_API_KEY=... \
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:... \
  CRON_SECRET=$(openssl rand -hex 32)
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` setzt Supabase automatisch.

**KI-Funktionen** (Texte/Betreff generieren, Ausweiserkennung, Chat) nutzen `LOVABLE_API_KEY` und `ai.gateway.lovable.dev`. Außerhalb von Lovable durch einen eigenen Anbieter ersetzen (z. B. OpenAI-kompatible URL + eigener Key).
Funktionen mit `LOVABLE_CRON_SECRET` erwarten ein Cron-Geheimnis – Wert als `LOVABLE_CRON_SECRET` setzen und zeitgesteuerte Aufrufe über **Database → Cron** (pg_cron + pg_net) neu anlegen.

## 5. Daten übernehmen (optional)
Bestehende Daten aus Lovable Cloud im Admin-Bereich unter **Datenexport** exportieren und über die Import-Funktion bzw. CSV-Import (Table Editor) einspielen. Dateien aus den Speicher-Buckets separat hochladen.

## 6. Frontend auf dem VPS
```bash
git clone <ihr-github-repo> epp && cd epp
cat > .env.production <<EOF
VITE_EXTERNAL_SUPABASE_URL=https://quhkqiznwatvjxgdzzpy.supabase.co
VITE_EXTERNAL_SUPABASE_ANON_KEY=<anon key>
EOF
npm ci && npm run build      # Ergebnis in dist/
```
Nginx-Beispiel:
```nginx
server {
  server_name ihre-domain.de;
  root /var/www/epp/dist;
  location / { try_files $uri $uri/ /index.html; }
}
```
SSL: `certbot --nginx -d ihre-domain.de`.
