# EuroScent – Bewerberaufnahme ohne Terminal einrichten

Die App nutzt weiterhin dein eigenes Backend. Die neuen Seiten sind vorbereitet, aber die folgenden Änderungen müssen dort einmal eingerichtet werden. Bestehende Mitarbeiter bleiben im bisherigen Ablauf; die neue Aktivierungsprüfung gilt für Bewerber, die über „Bewerbung annehmen“ aufgenommen werden.

## 1. Privaten Speicher prüfen
Öffne in deinem eigenen Backend den Bereich **Storage**. Der Bucket **verification-documents** muss vorhanden und **privat** sein. Er darf nicht öffentlich sein: Hier landen Ausweisbilder und neue Lebensläufe. Falls er fehlt, über **New bucket** mit genau diesem Namen privat anlegen. Maximalgröße: mindestens 5 MB; erlaubte Dateitypen: PDF, JPG, PNG und WebP.

## 2. SQL ausführen
Öffne **SQL Editor → New query**. Öffne `bewerberaufnahme.sql`, kopiere den gesamten Inhalt, füge ihn ein und klicke **Run**. Das Skript ist ein Update für deine bereits vorhandene EuroScent-Datenbank, kein Ersatz für das komplette Grundschema.

## 3. Eine neue Serverfunktion anlegen
Öffne **Edge Functions → Create a new function**.
- Name: **applicant-api**
- Kopiere den gesamten Inhalt von `functions/applicant-api/index.ts` in den Editor.
- **Verify JWT ausschalten**: Bewerbungen müssen ohne Anmeldung möglich sein; Annahmen prüfen die Anmeldung und Adminrolle im Programm selbst.
- Auf **Deploy** klicken. Die Datei ist eigenständig und benötigt keine zusätzlichen lokalen Dateien.

## 4. Erlaubte Website und Zugangsmails
Unter **Edge Functions → Secrets** einen neuen Eintrag setzen:
- Name: **APPLICANT_ALLOWED_ORIGINS**
- Wert: Die vollständige Adresse deiner Website, ohne abschließenden Schrägstrich. Mehrere Adressen mit Komma trennen, beispielsweise veröffentlichte Website und Vorschau. Keine Zugangsschlüssel in diesen Wert schreiben.

Unter **Authentication → URL Configuration**:
- **Site URL**: deine veröffentlichte Website.
- **Redirect URLs**: für jede erlaubte Website die Adresse mit `/reset-password` ergänzen.

Zugangsmails verwenden die eingebauten Auth-Mails deines eigenen Backends. Prüfe die SMTP-Einstellungen und die Zustellung für echte Empfänger. Ein angenommener Vertrag bleibt gespeichert, wenn die Mail scheitert; über **Passwortlink senden** kannst du die Mail erneut anfordern. Die App verspricht keine Zustellung, solange sie nicht geprüft ist.

## 5. Ablauf
1. Bewerber öffnet **Bei EuroScent bewerben** auf der Anmeldeseite und schickt das Formular ab.
2. Admin öffnet **Neue Bewerber**, prüft die Daten und führt das Telefoninterview.
3. **Bewerbung annehmen**: aktive Vertragsvorlage, Startdatum und Vergütung auswählen. Die Vergütungsperiode entspricht dem Text der Vorlage; sie wird nicht automatisch in einen Monatsbetrag umgerechnet.
4. Das Konto wird erstellt oder mit einem bestehenden Konto gleicher E-Mail verbunden. Der Vertrag wird als feste Fassung gespeichert. Wiederholte Annahme erstellt keinen zweiten Vertrag.
5. Bewerber legt über die Zugangsmail sein Passwort fest und öffnet **Mitarbeiteraufnahme**.
6. Vertrag lesen, am Bildschirm unterschreiben und Zustimmung bestätigen.
7. Kontoinhaber, IBAN und BIC eingeben. Die Bankdaten werden erst nach Unterschrift akzeptiert.
8. Vorder- und Rückseite des Ausweises hochladen und zur Prüfung einreichen.
9. Admin öffnet **Verifizierungen**, prüft beide Bilder und genehmigt oder lehnt mit Begründung ab. Bei Ablehnung kann der Mitarbeiter neue Bilder einreichen.
10. Nach Annahme, Unterschrift, vollständigen Bankdaten und genehmigter Identität wird der Mitarbeiter automatisch **Aktiv**. Erst dann kann der Admin neue Tasks zuweisen und der Mitarbeiter diese bearbeiten.

Die aktuelle Arbeitgeberunterschrift wird bei Annahme eingefroren, wenn sie bereits in den Unternehmenseinstellungen hinterlegt ist. Ein fehlendes Bild wird nicht erfunden. Unterschriften gelten nur für die betreffende Vertragsfassung. Die App dokumentiert eine elektronische Unterschrift, ersetzt aber keine rechtliche Prüfung der Vertragsform oder ein qualifiziertes Signaturverfahren.

## 6. Kontrolle nach Einrichtung
Eine echte Testbewerbung abgeben und als Admin in **Neue Bewerber** wiederfinden. Dann mit derselben Testperson den kompletten Ablauf einschließlich Zugangsmail, Unterschrift, Bankdaten, Ablehnung/Neuupload, Genehmigung und Task durchspielen. Dieses Paket wurde lokal mit Datenbanktests geprüft; die Einrichtung, Zustellung von Auth-Mails und der angemeldete Gesamtfluss auf deinem eigenen Backend bleiben bis dahin unbestätigt.

Neue Seiten sind Deutsch/Englisch. Bestehende Altseiten behalten ihre bisherigen Übersetzungen. Bestehende Mitarbeiter und bereits unterschriebene Altverträge werden nicht automatisch in den neuen Aufnahmeablauf migriert.