# Bewerberaufnahme und Mitarbeiteraktivierung

## Ergebnis
Ein durchgängiger Ablauf von der Bewerbung bis zum aktiven Mitarbeiterkonto. Die vorhandene Aufgabenverwaltung und der EuroScent-Stil bleiben erhalten.

### 1. Bewerbung und neue Bewerber
- Das Bewerbungsformular unter `/bewerbung` öffentlich erreichbar machen und von der Anmeldung verlinken; keine Marketing-Homepage hinzufügen.
- Name, Kontakt, Geburtsdatum, Adresse und gewünschte Vertragsart erfassen. Hochgeladene Bewerbungsunterlagen nur für berechtigte Admins verfügbar machen.
- Im Admin-Menü „Neue Bewerber“ ergänzen. Neue Bewerbungen automatisch nachladen; Details, Ablehnung und Annahme anbieten.
- Passwortzurücksetzung für bereits angelegte Bewerberkonten über den bestehenden geschützten Ablauf bereitstellen.

### 2. Annahme und Vertrag
- Nach dem Telefoninterview öffnet „Bewerbung annehmen“ eine Auswahl der aktiven Vertragsvorlagen sowie Startdatum und Vergütung.
- Annahme, Konto-Zuordnung und Vertragsbereitstellung zu einem abgesicherten, wiederholbar ausführbaren Vorgang verbinden; keine doppelten Konten oder Verträge erzeugen.
- Neue Bewerber erhalten einen persönlichen Link zum Festlegen ihres Passworts. Bestehende Konten behalten ihren Zugang.
- Den ausgewählten Vertrag mit Bewerberdaten erstellen und als feste Vertragsfassung speichern; nicht später unbemerkt durch eine andere Vorlage ersetzen.
- Mitarbeiter unterschreiben im Dashboard. Mitarbeiter und Admin können dieselbe unterschriebene Fassung mit Unterschriftszeitpunkt einsehen.

### 3. Bankdaten und Identitätsprüfung
- Bankdateneingabe erst nach Vertragsunterschrift freischalten; Kontoinhaber, IBAN und BIC prüfen und nur für den Mitarbeiter und berechtigte Admins verfügbar machen.
- Vorder- und Rückseite des Ausweises in privatem Dateispeicher hochladen; beide Bilder für die Einreichung verlangen.
- Unter „Verifizierungen“ können Admins die Bilder ansehen, genehmigen oder mit Begründung ablehnen.
- Bei Ablehnung bleibt die Begründung sichtbar und der Bewerber kann beide Bilder erneut einreichen. Keine automatische Genehmigung allein durch einen Upload.

### 4. Automatische Aktivierung und Statusübersicht
- Der Status wird ausschließlich dann „Aktiv“, wenn alle vier Bedingungen erfüllt sind: Bewerbung angenommen, Vertrag unterschrieben, Bankdaten vollständig, Identität vom Admin genehmigt.
- Diese Bedingungen serverseitig absichern: Mitarbeiter dürfen weder ihre Identität selbst genehmigen noch ihren Aktivstatus verändern.
- Im Mitarbeiter-Dashboard die abgeschlossenen und ausstehenden Schritte mit direktem Zugang zum nächsten Schritt anzeigen.
- Im Admin-Bereich die gleichen Aufnahmezustände pro Mitarbeiter anzeigen, ohne dort Bankdaten oder Ausweisbilder offenzulegen.

### 5. Tasks
- Die vorhandene Aufgabenverwaltung unter „Tasks“ erreichbar machen.
- Erstellung, Zuweisung und Bearbeitungsstatus weiterverwenden und den Ablauf mit dem neuen Aktivstatus abstimmen: reguläre Bearbeitung erst nach vollständiger Aktivierung, Admins sehen den Grund einer noch gesperrten Zuweisung.

## Technische Umsetzung
- Bestehende Bewerbungs-, Dokumenten-, Profil- und Aufgabenseiten integrieren, statt parallele Abläufe aufzubauen.
- Kontozuordnung, ausgewählte Vertragsfassung, Unterschriftsnachweis, Identitätsprüfstatus und Aktivierung nachvollziehbar speichern. Rollen bleiben in der geschützten Rollentabelle.
- Annahme und Prüfentscheidungen über authentifizierte, adminberechtigte Serverfunktionen abwickeln; Datenzugriff und Statuswechsel durch Datenbankregeln schützen.
- Für dein eigenes Backend die nötigen SQL-Skripte und Serverfunktionen unter `selfhost/` mit einer Browser-Anleitung bereitstellen. Deine externe Datenbank wird nicht durch Änderungen an der verbundenen Lovable-Cloud-Datenbank ersetzt.
- Neue Texte sowohl auf Deutsch als auch auf Englisch bereitstellen.

## Prüfung und Übergabe
- Kleine automatisierte Tests für jede Aktivierungsbedingung, die Reihenfolge von Unterschrift und Bankdaten sowie Ablehnung und erneute Einreichung ergänzen.
- Bewerbungsabgabe, Annahme, Vertragsunterschrift, Bankdaten, Ausweisprüfung und Aufgabenbearbeitung mit Mitarbeiter- und Adminzugang durchspielen, soweit die externe Umgebung zugänglich ist.
- Nicht live prüfbare Schritte ausdrücklich benennen; keine vollständige Funktionsgarantie ohne Einrichtung und Prüfung deines externen Backends behaupten.
- SQL- und Funktionsänderungen müssen einmalig in deinem eigenen Backend eingespielt werden; dazu erhältst du eine Anleitung ohne Terminal.