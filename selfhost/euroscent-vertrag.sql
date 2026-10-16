-- EuroScent Arbeitsvertrag (Teilzeit) als Vertragsvorlage einrichten
-- Im Supabase SQL Editor komplett einfuegen und einmal ausfuehren (Run).
-- Danach kann der Vertrag in der Mitarbeiterverwaltung an einen Arbeiter
-- geschickt werden (Vertrag erstellen) und erscheint im Onboarding.

BEGIN;

-- Alte Teilzeit-Vorlagen deaktivieren, damit nur diese verwendet wird
UPDATE public.contract_templates
SET is_active = false, updated_at = now()
WHERE lower(category) = 'teilzeit';

-- Neue Vorlage einfuegen
INSERT INTO public.contract_templates (name, category, version, content, is_active, default_salary)
VALUES (
  'Arbeitsvertrag Teilzeit (EuroScent)',
  'Teilzeit',
  '2.0',
  $vertrag$§1 Beginn des Arbeitsverhaeltnisses

Dieses Arbeitsverhaeltnis beginnt am {{startdatum}}.

§2 Arbeitszeit und flexible Aufgabeneinteilung

Die regelmaessige Arbeitszeit betraegt 20 Stunden pro Woche. Die Arbeitsleistung wird flexibel und grundsaetzlich von Montag bis Sonntag erbracht. Der Arbeitnehmer kann seine Arbeitszeit innerhalb dieses Zeitraums eigenstaendig einteilen, soweit keine betrieblichen Erfordernisse oder gesonderten Terminvereinbarungen entgegenstehen. Zur Organisation und Durchfuehrung der Taetigkeit werden dem Arbeitnehmer ueber das unternehmenseigene Mitarbeiter-Dashboard grundsaetzlich 20 Aufgaben pro Kalenderwoche zugeteilt. Die Aufgaben dienen der Planung und Strukturierung der vereinbarten Wochenarbeitszeit. Der tatsaechliche Zeitaufwand kann abhaengig von Art und Umfang der jeweiligen Aufgaben variieren.

Der Arbeitnehmer organisiert die Bearbeitung der zugewiesenen Aufgaben eigenverantwortlich innerhalb der vereinbarten Arbeitszeit. Die gesetzlichen Bestimmungen zu Arbeitszeit, Ruhezeiten und Sonn- und Feiertagsarbeit bleiben unberuehrt.

Die Aufgabenzuteilung ueber das Dashboard dient der Arbeitsorganisation. Massgeblich fuer die vereinbarte Arbeitszeit bleibt die regelmaessige Wochenarbeitszeit von 20 Stunden. Abweichungen bei der Anzahl oder beim Umfang der zugewiesenen Aufgaben sind mit dem Arbeitgeber abzustimmen.

§3 Verguetung

Der Arbeitnehmer erhaelt bei einer Teilzeitwoche von 20 Stunden eine Verguetung von {{gehalt}} Euro brutto.

Die Verguetung ist jeweils am Monatsende des Folgemonats faellig und wird per Ueberweisung an das vom Arbeitnehmer benannte Konto ueberwiesen.

Der Arbeitnehmer ist darauf hingewiesen worden, dass er auf Antrag von der Rentenversicherungspflicht befreit werden kann. Der schriftliche Befreiungsantrag ist dem Arbeitgeber zu uebergeben (§ 6 Abs. 1b Sozialgesetzbuch Sechstes Buch - SGB).

Dem Arbeitnehmer ist bekannt, dass ein entsprechender Verzicht nur mit Wirkung fuer die Zukunft und bei Ausuebung von mehreren geringfuegigen Beschaeftigungsverhaeltnissen nur einheitlich erklaert werden kann und diese Erklaerung den Arbeitnehmer fuer die Dauer der Beschaeftigungen bindet.

§4 Sonderzuwendungen

Der Arbeitgeber zahlt Sonderzuwendungen (Urlaubsgeld, Weihnachtsgeld) in den Monaten Juni und Dezember in Hoehe von jeweils 520 Euro.

§5 Datenschutz und Loeschung von Ausweisdokumenten im Rahmen von KYC-Testverfahren

Sofern der Arbeitnehmer im Rahmen eines KYC-Testauftrags eigene Ausweisdokumente, beispielsweise einen Personalausweis oder Reisepass, zur Durchfuehrung des Tests verwendet, werden die hierbei im Verantwortungsbereich des Arbeitgebers erhobenen und gespeicherten personenbezogenen Daten sowie gegebenenfalls angefertigte Kopien oder Testaufzeichnungen nach Abschluss des jeweiligen Testauftrags geloescht, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.

Die Ausweisdokumente werden ausschliesslich fuer die Durchfuehrung des ausdruecklich vereinbarten Testverfahrens verwendet.

Eine dauerhafte Speicherung, Weiterverwendung oder Nutzung der Ausweisdaten zu anderen Zwecken durch den Arbeitgeber erfolgt nicht.

Die Testauftraege dienen der Pruefung digitaler Identifizierungs- und Verifizierungsprozesse.

Eine tatsaechliche Kontoeroeffnung, der Abschluss eines Bankvertrags oder die Beantragung eines Finanzprodukts ist nicht vorgesehen, sofern dies nicht ausdruecklich und gesondert vereinbart wurde.

Die Verarbeitung erfolgt nach Massgabe der geltenden Datenschutzbestimmungen, insbesondere der Datenschutz-Grundverordnung (DSGVO).

§6 Urlaubsanspruch

Der Arbeitnehmer hat grundsaetzlich einen Anspruch auf einen jaehrlichen Erholungsurlaub von 28 Arbeitstagen. Zeitpunkt und Dauer des Urlaubs richten sich nach den betrieblichen Notwendigkeiten und Moeglichkeiten unter Beruecksichtigung der Wuensche des Arbeitnehmers.

Im Uebrigen gelten ergaenzend die Bestimmungen des Bundesurlaubsgesetzes in der jeweils geltenden Fassung.

§7 Arbeitsverhinderung

Der Arbeitnehmer verpflichtet sich, jede Arbeitsverhinderung unverzueglich - noch vor Dienstbeginn - dem Arbeitgeber unter Benennung der voraussichtlichen Verhinderungsdauer schriftlich mitzuteilen.

Im Krankheitsfall hat der Arbeitnehmer unverzueglich, spaetestens jedoch nach Ablauf des dritten Kalendertages, dem Arbeitgeber eine aerztlich erstellte Arbeitsunfaehigkeitsbescheinigung vorzulegen, aus der sich die voraussichtliche Dauer der Krankheit ergibt. Dauert die Krankheit laenger an als in der aerztlich erstellten Bescheinigung angegeben, so ist der Arbeitnehmer gleichfalls zur unverzueglichen Mitteilung und Vorlage einer weiteren Bescheinigung verpflichtet.

Der Arbeitgeber zahlt im Falle einer unverschuldeten Arbeitsunfaehigkeit infolge Krankheit fuer sechs Wochen das regelmaessige Arbeitsentgelt weiter (Entgeltfortzahlung im Krankheitsfall).

Im Uebrigen gelten fuer den Krankheitsfall die jeweils massgeblichen gesetzlichen Bestimmungen.

§8 Einstellungsfragebogen

Der als Anlage beigefuegte Einstellungsfragebogen ist Bestandteil dieses Vertrages. Der Arbeitnehmer versichert die Vollstaendigkeit und Richtigkeit der gemachten Angaben.

§9 Weitere Beschaeftigungen

Der Arbeitnehmer verpflichtet sich, jede Aufnahme einer weiteren Beschaeftigung dem Arbeitgeber unverzueglich schriftlich mitzuteilen. Dies gilt fuer saemtliche Beschaeftigungen, unabhaengig von der Hoehe des Verdienstes oder deren zeitlichem Umfang.

§10 Kuendigungsfristen

Das Arbeitsverhaeltnis wird auf unbestimmte Zeit eingegangen. Die ersten 6 Wochen gelten als Probezeit. Waehrend dieser Zeit kann das Arbeitsverhaeltnis von beiden Seiten mit einer Frist von zwei Wochen (§ 622 Abs. 3 BGB) gekuendigt werden.

Nach Ablauf der Probezeit gelten die gesetzlichen Kuendigungsfristen. Verlaengert sich die Kuendigungsfrist fuer die Firma aus tariflichen oder gesetzlichen Gruenden, gilt diese Verlaengerung auch fuer den Arbeitnehmer.

Das Recht zur fristlosen Kuendigung aus wichtigem Grund bleibt hiervon unberuehrt.

Jede Kuendigung hat schriftlich zu erfolgen.

Der Arbeitgeber ist berechtigt, den Arbeitnehmer nach Ausspruch einer Kuendigung unter Fortzahlung der Verguetung und Anrechnung auf Resturlaubsansprueche von der Arbeitsleistung freizustellen.

§11 Unterschriften

Dieser Arbeitsvertrag wurde offiziell am {{startdatum}} von Rolf Erwin Ruhfus unterschrieben.

{{company_signature}}

Rolf Erwin Ruhfus

Datum, {{vorname}} {{nachname}}

{{signature}}$vertrag$,
  true,
  2200
);

COMMIT;
