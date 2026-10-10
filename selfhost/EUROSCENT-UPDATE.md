# EuroScent: Firmendaten und ES Assistent

## Ohne Terminal

1. Im SQL Editor deines eigenen Datenbankprojekts eine neue Abfrage öffnen.
2. Den gesamten Inhalt von `euroscent-firmendaten-chat.sql` einfügen und **Run** klicken.
3. Unter **Edge Functions** die bestehende Funktion **employee-chat** öffnen.
4. Den Inhalt ihrer `index.ts` durch die beiliegende `employee-chat/index.ts` ersetzen und **Deploy** klicken. Bestehende Einstellungen beibehalten.
5. Für aktualisierte Firmenangaben in ausgehenden E-Mails die beiliegenden Mail-Funktionen genauso aktualisieren (Ordnername = Funktionsname).
6. Die Webseite mit dem aktuellen Projektstand erneut auf Cloudflare bereitstellen.

Der Livechat nutzt jetzt die Anmeldung des Mitarbeiters statt des öffentlichen Schlüssels als Zugangsnachweis. Nachrichten werden geprüft gespeichert, bevor der Assistent antwortet. Wenn die automatische Antwort ausfällt, bleibt die Nachricht für den Admin erhalten. Beide Seiten laden neue Nachrichten zusätzlich alle fünf Sekunden, wenn die Echtzeitverbindung fehlt.

## Prüfung nach dem Update

- Mitarbeiter: ES Assistent öffnen, Nachricht senden, Chat schließen und erneut öffnen. Die Nachricht muss weiterhin sichtbar sein.
- Admin: Posteingang öffnen, Mitarbeiter auswählen und antworten.
- Mitarbeiter: Die Antwort muss spätestens nach einigen Sekunden erscheinen.
- Abrechnung: Neue PDF öffnen und Firmenname sowie Adresse kontrollieren.

Die Absenderdomain euroscent.de muss beim Mailanbieter bestätigt sein, damit office@euroscent.de senden darf. Vorhandene PDFs, unterschriebene Verträge und gespeicherte individuelle Mailvorlagen bleiben historische Dokumente und werden nicht rückwirkend verändert. Eine gespeicherte Unterschrift wird nicht als Unterschrift des neuen Vertreters ausgegeben: bitte dessen echte Unterschrift in den Einstellungen hinterlegen.

Authentifizierte Live-Tests auf deinem eigenen Projekt sind hier ohne deine aktive Sitzung nicht möglich; deshalb ist eine vollständige Zustellgarantie nicht verifiziert.