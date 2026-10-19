# EuroScent – Bewerberaufnahme ohne Terminal einrichten

Die App nutzt weiterhin dein eigenes Backend. Die neuen Seiten sind vorbereitet, aber die folgenden Änderungen müssen dort einmal eingerichtet werden. Bestehende Mitarbeiter bleiben im bisherigen Ablauf; die neue Aktivierungsprüfung gilt für Bewerber, die über „Bewerbung annehmen“ aufgenommen werden.

## 1. Privaten Speicher prüfen
Öffne in deinem eigenen Backend den Bereich **Storage**. Der Bucket **verification-documents** muss vorhanden und **privat** sein. Er darf nicht öffentlich sein: Hier landen Ausweisbilder und neue Lebensläufe. Falls er fehlt, über **New bucket** mit genau diesem Namen privat anlegen. Maximalgröße: mindestens 5 MB; erlaubte Dateitypen: PDF, JPG, PNG und WebP.

## 2. SQL ausführen
Öffne **SQL Editor → New query**. Öffne `bewerberaufnahme.sql`, kopiere den gesamten Inhalt, füge ihn ein und klicke **Run**. Das Skript ist ein Update für deine bereits vorhandene EuroScent-Datenbank, kein Ersatz für das komplette Grundschema.
Für selbst gewählte Zugangsdaten anschließend `bewerber-zugang.sql` vollständig in einer neuen Abfrage ausführen. Danach **applicant-api** durch die aktuelle Datei ersetzen und erneut **Deploy** klicken. Die Website erst danach veröffentlichen: Die neue Anmeldung per Benutzername benötigt diesen Dienst.

## 3. Eine neue Serverfunktion anlegen
Falls **applicant-api** bereits bereitgestellt ist, die bestehende Funktion öffnen, ihren Inhalt durch die aktuelle Datei ersetzen und erneut **Deploy** klicken. Die Aktualisierung behebt die Kontobereinigung bei fehlgeschlagener Annahme und verhindert eine gemeinsame Fünf-Bewerbungen-Grenze bei fehlender IP-Weitergabe. Das SQL muss dafür nicht erneut ausgeführt werden.

Öffne **Edge Functions → Create a new function**.
- Name: **applicant-api**
- Kopiere den gesamten Inhalt von `functions/applicant-api/index.ts` in den Editor.
- **Verify JWT ausschalten**: Bewerbungen müssen ohne Anmeldung möglich sein; Annahmen prüfen die Anmeldung und Adminrolle im Programm selbst.
- Auf **Deploy** klicken. Die Datei ist eigenständig und benötigt keine zusätzlichen lokalen Dateien.

## 4. Erlaubte Website und Zugangsmails
Unter **Edge Functions → Secrets** einen neuen Eintrag setzen:
- Name: **APPLICANT_ALLOWED_ORIGINS**
- Wert: Die vollständige Adresse deiner Website, ohne abschließenden Schrägstrich. Mehrere Adressen mit Komma trennen, beispielsweise veröffentlichte Website und Vorschau. Keine Zugangsschlüssel in diesen Wert schreiben.
- Für deine Mitarbeiter-Website muss **https://mitarbeiter.euroscent.de** enthalten sein; vorhandene Adressen beibehalten.

Unter **Authentication → URL Configuration**:
- **Site URL**: deine veröffentlichte Website.
- **Redirect URLs**: für jede erlaubte Website die Adresse mit `/reset-password` ergänzen.

Neue Bewerber wählen Benutzername und Passwort selbst, für sie wird keine Zugangsmail versandt. Nur alte Bewerbungen ohne eigene Zugangsdaten nutzen die eingebauten Auth-Mails deines eigenen Backends. Prüfe die SMTP-Einstellungen und die Zustellung für echte Empfänger. Ein angenommener Vertrag bleibt gespeichert, wenn eine Mail scheitert; der Bewerber holt sich bei Bedarf selbst einen neuen Link über **Passwort vergessen** auf der Anmeldeseite. Die App verspricht keine Zustellung, solange sie nicht geprüft ist.

## 5. Ablauf
1. Bewerber öffnet **Bei EuroScent bewerben** auf der Anmeldeseite und schickt das Formular ab.
2. Admin öffnet **Neue Bewerber**, prüft die Daten und führt das Telefoninterview.
3. **Bewerbung annehmen**: aktive Vertragsvorlage, Startdatum und Vergütung auswählen. Die Vergütungsperiode entspricht dem Text der Vorlage; sie wird nicht automatisch in einen Monatsbetrag umgerechnet.
4. Neue Bewerber wählen Benutzername und Passwort schon im Formular. Das Konto bleibt zunächst für Anmeldung und Passwort-Wiederherstellung gesperrt. Bei Annahme wird der Vertrag als feste Fassung gespeichert und der Login freigegeben. Wiederholte Annahme erstellt keinen zweiten Vertrag. Ein vorhandenes Konto wird nicht durch eine öffentliche Bewerbung überschrieben.
5. Bewerber meldet sich mit den gewählten Zugangsdaten an und öffnet **Mitarbeiteraufnahme**. Alte Bewerbungen ohne eigene Zugangsdaten behalten den Zugangsmail-Ablauf. Die Annahme bestätigt bei neuen Bewerberkonten auch deren E-Mail im Auth-Dienst; eine separate E-Mail-Bestätigung ist für diese Konten nicht nötig. Passwörter werden ausschließlich im Auth-Dienst verarbeitet, nicht in Bewerbungen oder Profilen gespeichert.
6. Vertrag lesen, am Bildschirm unterschreiben und Zustimmung bestätigen.
7. Kontoinhaber, IBAN und BIC eingeben. Die Bankdaten werden erst nach Unterschrift akzeptiert.
8. Vorder- und Rückseite des Ausweises hochladen und zur Prüfung einreichen.
9. Admin öffnet **Verifizierungen**, prüft beide Bilder und genehmigt oder lehnt mit Begründung ab. Bei Ablehnung kann der Mitarbeiter neue Bilder einreichen.
10. Nach Annahme, Unterschrift, vollständigen Bankdaten und genehmigter Identität wird der Mitarbeiter automatisch **Aktiv**. Erst dann kann der Admin neue Tasks zuweisen und der Mitarbeiter diese bearbeiten.

Die aktuelle Arbeitgeberunterschrift wird bei Annahme eingefroren, wenn sie bereits in den Unternehmenseinstellungen hinterlegt ist. Ein fehlendes Bild wird nicht erfunden. Unterschriften gelten nur für die betreffende Vertragsfassung. Die App dokumentiert eine elektronische Unterschrift, ersetzt aber keine rechtliche Prüfung der Vertragsform oder ein qualifiziertes Signaturverfahren.

## 6. Kontrolle nach Einrichtung
Eine echte Testbewerbung abgeben und als Admin in **Neue Bewerber** wiederfinden. Dann mit derselben Testperson den kompletten Ablauf einschließlich Zugangsmail, Unterschrift, Bankdaten, Ablehnung/Neuupload, Genehmigung und Task durchspielen. Dieses Paket wurde lokal mit Datenbanktests geprüft; die Einrichtung, Zustellung von Auth-Mails und der angemeldete Gesamtfluss auf deinem eigenen Backend bleiben bis dahin unbestätigt.

Neue Seiten sind Deutsch/Englisch. Bestehende Altseiten behalten ihre bisherigen Übersetzungen. Bestehende Mitarbeiter und bereits unterschriebene Altverträge werden nicht automatisch in den neuen Aufnahmeablauf migriert.