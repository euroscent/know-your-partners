# Projekt-Hinweise (bitte zuerst lesen)

Diese Datei erklärt dem Lovable-Chat (und dir) den aktuellen Stand und die wichtigsten Regeln dieses Projekts. **Lies sie bei jeder neuen Aufgabe zuerst.**

## Was ist das für ein Projekt?

Interne Mitarbeiter-App (Dashboard). Es gibt **keine öffentliche Homepage** – die Startadresse leitet direkt auf den Login um. Es gibt nur:

- Mitarbeiter-Login und Admin-Login
- Dashboard (geschützter Bereich)
- Passwort-zurücksetzen und App-Installation (gehören zum Login)

Öffentliche Seiten wie Karriere, Kontakt oder Bewerbung wurden entfernt und sollen **nicht** wieder hinzugefügt werden.

## Wichtig: Eigenes Supabase (NICHT Lovable Cloud)

Dieses Projekt ist bewusst **von Lovable Cloud getrennt** und nutzt ein externes, eigenes Supabase-Projekt:

- Der Client liegt in `src/integrations/external/client.ts` (ausgelagerte Konstanten, eigener Browser-Client).
- Die App soll **nicht** über `@/integrations/supabase/client` laufen, sondern über den externen Client.
- Ziel: Das Projekt soll später eigenständig auf einem VPS betrieben werden.

### Zugangsdaten (öffentlich, dürfen im Code stehen)

- Project URL: `https://quhkqiznwatvjxgdzzpy.supabase.co`
- anon/public key: in `.env.example` bzw. `.env` hinterlegt

**Niemals** den `service_role`-Schlüssel oder das Datenbank-Passwort in den Code oder den Chat geben.

## Datenbank einrichten

1. Datei `selfhost/schema.sql` komplett kopieren.
2. Im eigenen Supabase im **SQL Editor** einfügen und ausführen (Run). Das erstellt alle Tabellen, Zugriffsregeln (RLS), Funktionen und Trigger.
3. Danach den ersten Admin-Benutzer anlegen (Anleitung in `selfhost/ANLEITUNG.md`).

Ohne diesen Schritt funktioniert der Login nicht.

## Self-Hosting auf VPS

Siehe `selfhost/ANLEITUNG.md`. Kurzfassung:

- Umgebungsvariablen aus `.env.example` setzen.
- Serverfunktionen (E-Mail, SMS, Telegram, Push) müssen als Supabase Edge Functions im eigenen Projekt bereitgestellt werden.
- Geheime Schlüssel (API-Keys) werden als Secrets im eigenen Supabase hinterlegt, nicht im Code.

## Bekannte Einschränkungen

- **Lovable AI / KI-Funktionen** funktionieren außerhalb von Lovable nicht – dafür wird ein eigener KI-Anbieter gebraucht.
- Bestehende Daten aus dem alten Projekt werden nicht automatisch übernommen (Export/Import nötig).
- Folgende Secrets waren im alten Projekt hinterlegt und müssen im neuen Supabase neu gesetzt werden (Werte liegen nur beim Betreiber):
  ANOSIM_API_KEY, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, MCP_API_KEY, RESEND_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT, VMOS_ACCESS_KEY, VMOS_API_KEY, VMOS_SECRET_KEY

## Regeln für den Chat

1. Keine öffentlichen Marketing-Seiten hinzufügen.
2. Keine Lovable-Cloud-Abhängigkeiten einbauen (kein `@/integrations/supabase/client`, keine Cloud-only Features).
3. Datenbank-Änderungen immer als SQL in `selfhost/schema.sql` bzw. als neue Migration dokumentieren, damit sie im eigenen Supabase nachgezogen werden können.
4. Bei Fragen zu Zugangsdaten: nur anon/publishable key verwenden.
