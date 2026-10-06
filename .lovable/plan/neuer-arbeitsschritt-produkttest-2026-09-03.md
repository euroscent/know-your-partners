# Neuer Arbeitsschritt „Produkttest“

## Analyse der bestehenden Architektur

- Schritt-Typen sind zentral in `TaskStep` definiert (`src/components/admin/SortableStepEditor.tsx`), aktuell `text` (Einleitung), `checkbox` (Zustimmung), `file` (Datei).
- Schritte werden als JSON-Array in `tasks.steps` gespeichert; Antworten der Mitarbeiter liegen als JSON in `task_submissions.step_responses` / `admin_data`.
- Builder: `src/pages/admin/TaskManagement.tsx` (Tab „Steps“, Dropdown „Typ“, `handleAddStep`, `SortableStepEditor`).
- Mitarbeiter-Flow: `TaskDetail` → `TaskDemoData` (KYC) → `TaskQualityCheck` / `TaskPostalDocumentsCheck` → `TaskSubmitted`, gesteuert über Routen in `App.tsx` und Statusfelder in `task_submissions.admin_data`.
- UI: bestehende shadcn-Komponenten (Card, Input, Textarea, Select, Button, Badge) im Dark-Theme — werden unverändert wiederverwendet.

## Umsetzung

### 1. Builder (lokal erweitert, keine Refactorings)
- `TaskStep` erhält den neuen Typ `product_test` plus optionales `product_test`-Konfigurationsobjekt: Titel, Beschreibung, Dauer + Einheit (Minuten/Stunden/Tage), optionale Startbestätigung (Text), Testaufgaben-Liste, Bewertungsfragen-Liste.
- `SortableStepEditor` zeigt bei Typ `product_test` einen zusätzlichen Konfigurationsblock mit bestehenden Inputs/Selects: Grundeinstellungen, dynamische Testaufgaben (hinzufügen/bearbeiten/entfernen) und dynamische Bewertungsfragen (Typen: 1–5, 1–10, Ja/Nein, Einfachauswahl mit Optionen, Freitext; Pflicht-Flag; optionale Folgefrage bei „Ja“).
- Dropdown „Typ“ und Typ-Label um „Produkttest“ ergänzt.

### 2. Datenmodell (Erweiterung, keine Parallelstruktur)
- Produkttest-Definition bleibt in `tasks.steps` (kein neues Definitions-Table).
- Neue Tabelle `product_test_participations`: `submission_id`, `task_id`, `user_id`, `step_id`, `status` (`not_started` | `running` | `ready_for_review` | `completed`), `started_at`, `review_available_at`, `completed_at`, `answers` (jsonb), Unique je `submission_id` + `step_id`.
- RLS: Mitarbeiter sehen/starten nur eigene Teilnahmen, Admins alles (bestehendes `has_role`); GRANTs für `authenticated` und `service_role`.

### 3. Serverseitige Zeitlogik
- Neue Edge Function `product-test` mit Actions:
  - `start` — setzt `started_at = now()` serverseitig und berechnet `review_available_at` aus der im Task gespeicherten Dauer; ignoriert erneute Starts.
  - `status` — liefert Status inkl. serverseitig berechneter Restzeit.
  - `submit` — prüft `now() >= review_available_at`, validiert Pflichtfragen, schreibt `answers`, setzt `completed`. Bereits abgeschlossene Teilnahmen werden abgelehnt (kein Doppelversand).

### 4. Mitarbeiter-Ansicht
- Neue Seite `src/pages/ProductTest.tsx` unter `/dashboard/tasks/:taskId/product-test`, im Layout/Stil der bestehenden Task-Seiten (`TaskQualityCheck` als Vorlage).
- Zustände: Start (Beschreibung + optionale Bestätigungs-Checkbox + Button „Produkttest starten“), Laufend (Startzeit, Testdauer, „Bewertung verfügbar ab“, Restzeit, Testaufgaben-Liste, deaktivierter Button „Bewertung noch nicht verfügbar“), Bewertung (dynamisches Fragenformular), Abschluss („Produkttest abgeschlossen“).
- Status wird bei jedem Laden vom Server geholt — reload-/loginfest.

### 5. Einbindung in den Ablauf
- Nach KYC-Abschluss (`TaskDemoData`) und vor der Qualitätssicherung: enthält der Auftrag einen `product_test`-Schritt, dessen Teilnahme noch nicht `completed` ist, wird auf `/product-test` geleitet; danach weiter in den bestehenden Flow (Qualitätssicherung bzw. Postversand). Bestehende KYC-Logik bleibt inhaltlich unverändert, nur diese Weiterleitungsstelle wird ergänzt.
- Aufträge ohne Produkttest-Schritt verhalten sich exakt wie bisher.

### 6. Beispiel eazy
- Nach der Implementierung wird der Beispiel-Produkttest („eazy SIM-Produkttest“, 24 Stunden, 5 Testaufgaben, 10 Bewertungsfragen) als vorgefertigte Vorlage im Builder per Button „Beispiel eazy SIM einfügen“ verfügbar gemacht, damit keine Fest-Programmierung auf SIM-Karten entsteht.

## Technische Hinweise
- Keine bestehenden Felder, Tabellen oder Funktionen werden verändert oder entfernt.
- Alle neuen UI-Elemente nutzen ausschließlich vorhandene Komponenten und Design-Tokens.
- Fehlerbehandlung über die bestehende Toast-/Try-Catch-Konvention.
