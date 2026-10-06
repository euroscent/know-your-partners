# Mitarbeiter-Anmeldung reparieren

## Ziel
Mitarbeiter sollen bei ungültigen oder unbekannten Zugangsdaten ihr Passwort selbst sicher neu setzen können, statt im Ladezustand festzuhängen.

## Umsetzung
- Login-Formular um „Passwort vergessen?“ ergänzen.
- Reset-E-Mail an die eingegebene Adresse senden und eine klare Bestätigung anzeigen.
- Öffentliche Seite zum Festlegen eines neuen Passworts ergänzen.
- Lade-, Erfolgs- und Fehlerzustände so absichern, dass die Anmeldung nie dauerhaft lädt.
- Anmeldung und Passwort-Wiederherstellung im veröffentlichten Ablauf prüfen.

## Technische Details
- Wiederherstellungslink führt auf `/reset-password`.
- Die Reset-Seite akzeptiert nur eine gültige Wiederherstellungssitzung und speichert das neue Passwort über den bestehenden Anmeldedienst.
- Bestehende Mitarbeiterdaten und Rollen bleiben unverändert.
