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
  $vertrag$§1 Beginn des Arbeitsverhältnisses

Dieses Arbeitsverhältnis beginnt am {{startdatum}}.

§2 Arbeitszeit und flexible Aufgabeneinteilung

Die regelmäßige Arbeitszeit beträgt 20 Stunden pro Woche. Die Arbeitsleistung wird flexibel und grundsätzlich von Montag bis Sonntag erbracht. Der Arbeitnehmer kann seine Arbeitszeit innerhalb dieses Zeitraums eigenständig einteilen, soweit keine betrieblichen Erfordernisse oder gesonderten Terminvereinbarungen entgegenstehen. Zur Organisation und Durchführung der Tätigkeit werden dem Arbeitnehmer über das unternehmenseigene Mitarbeiter-Dashboard grundsätzlich 20 Aufgaben pro Kalenderwoche zugeteilt. Die Aufgaben dienen der Planung und Strukturierung der vereinbarten Wochenarbeitszeit. Der tatsächliche Zeitaufwand kann abhängig von Art und Umfang der jeweiligen Aufgaben variieren.

Der Arbeitnehmer organisiert die Bearbeitung der zugewiesenen Aufgaben eigenverantwortlich innerhalb der vereinbarten Arbeitszeit. Die gesetzlichen Bestimmungen zu Arbeitszeit, Ruhezeiten und Sonn- und Feiertagsarbeit bleiben unberührt.

Die Aufgabenzuteilung über das Dashboard dient der Arbeitsorganisation. Maßgeblich für die vereinbarte Arbeitszeit bleibt die regelmäßige Wochenarbeitszeit von 20 Stunden. Abweichungen bei der Anzahl oder beim Umfang der zugewiesenen Aufgaben sind mit dem Arbeitgeber abzustimmen.

§3 Vergütung

Der Arbeitnehmer erhält bei einer Teilzeitwoche von 20 Stunden eine Vergütung von {{gehalt}} Euro brutto.

Die Vergütung ist jeweils am Monatsende des Folgemonats fällig und wird per Überweisung an das vom Arbeitnehmer benannte Konto überwiesen.

Der Arbeitnehmer ist darauf hingewiesen worden, dass er auf Antrag von der Rentenversicherungspflicht befreit werden kann. Der schriftliche Befreiungsantrag ist dem Arbeitgeber zu übergeben (§ 6 Abs. 1b Sozialgesetzbuch Sechstes Buch - SGB).

Dem Arbeitnehmer ist bekannt, dass ein entsprechender Verzicht nur mit Wirkung für die Zukunft und bei Ausübung von mehreren geringfügigen Beschäftigungsverhältnissen nur einheitlich erklärt werden kann und diese Erklärung den Arbeitnehmer für die Dauer der Beschäftigungen bindet.

§4 Sonderzuwendungen

Der Arbeitgeber zahlt Sonderzuwendungen (Urlaubsgeld, Weihnachtsgeld) in den Monaten Juni und Dezember in Höhe von jeweils 520 Euro.

§5 Datenschutz und Löschung von Ausweisdokumenten im Rahmen von KYC-Testverfahren

Sofern der Arbeitnehmer im Rahmen eines KYC-Testauftrags eigene Ausweisdokumente, beispielsweise einen Personalausweis oder Reisepass, zur Durchführung des Tests verwendet, werden die hierbei im Verantwortungsbereich des Arbeitgebers erhobenen und gespeicherten personenbezogenen Daten sowie gegebenenfalls angefertigte Kopien oder Testaufzeichnungen nach Abschluss des jeweiligen Testauftrags gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.

Die Ausweisdokumente werden ausschließlich für die Durchführung des ausdrücklich vereinbarten Testverfahrens verwendet.

Eine dauerhafte Speicherung, Weiterverwendung oder Nutzung der Ausweisdaten zu anderen Zwecken durch den Arbeitgeber erfolgt nicht.

Die Testaufträge dienen der Prüfung digitaler Identifizierungs- und Verifizierungsprozesse.

Eine tatsächliche Kontoeröffnung, der Abschluss eines Bankvertrags oder die Beantragung eines Finanzprodukts ist nicht vorgesehen, sofern dies nicht ausdrücklich und gesondert vereinbart wurde.

Die Verarbeitung erfolgt nach Maßgabe der geltenden Datenschutzbestimmungen, insbesondere der Datenschutz-Grundverordnung (DSGVO).

§6 Urlaubsanspruch

Der Arbeitnehmer hat grundsätzlich einen Anspruch auf einen jährlichen Erholungsurlaub von 28 Arbeitstagen. Zeitpunkt und Dauer des Urlaubs richten sich nach den betrieblichen Notwendigkeiten und Möglichkeiten unter Berücksichtigung der Wünsche des Arbeitnehmers.

Im Übrigen gelten ergänzend die Bestimmungen des Bundesurlaubsgesetzes in der jeweils geltenden Fassung.

§7 Arbeitsverhinderung

Der Arbeitnehmer verpflichtet sich, jede Arbeitsverhinderung unverzüglich - noch vor Dienstbeginn - dem Arbeitgeber unter Benennung der voraussichtlichen Verhinderungsdauer schriftlich mitzuteilen.

Im Krankheitsfall hat der Arbeitnehmer unverzüglich, spätestens jedoch nach Ablauf des dritten Kalendertages, dem Arbeitgeber eine ärztlich erstellte Arbeitsunfähigkeitsbescheinigung vorzulegen, aus der sich die voraussichtliche Dauer der Krankheit ergibt. Dauert die Krankheit länger an als in der ärztlich erstellten Bescheinigung angegeben, so ist der Arbeitnehmer gleichfalls zur unverzüglichen Mitteilung und Vorlage einer weiteren Bescheinigung verpflichtet.

Der Arbeitgeber zahlt im Falle einer unverschuldeten Arbeitsunfähigkeit infolge Krankheit für sechs Wochen das regelmäßige Arbeitsentgelt weiter (Entgeltfortzahlung im Krankheitsfall).

Im Übrigen gelten für den Krankheitsfall die jeweils maßgeblichen gesetzlichen Bestimmungen.

§8 Einstellungsfragebogen

Der als Anlage beigefügte Einstellungsfragebogen ist Bestandteil dieses Vertrages. Der Arbeitnehmer versichert die Vollständigkeit und Richtigkeit der gemachten Angaben.

§9 Weitere Beschäftigungen

Der Arbeitnehmer verpflichtet sich, jede Aufnahme einer weiteren Beschäftigung dem Arbeitgeber unverzüglich schriftlich mitzuteilen. Dies gilt für sämtliche Beschäftigungen, unabhängig von der Höhe des Verdienstes oder deren zeitlichem Umfang.

§10 Kündigungsfristen

Das Arbeitsverhältnis wird auf unbestimmte Zeit eingegangen. Die ersten 6 Wochen gelten als Probezeit. Während dieser Zeit kann das Arbeitsverhältnis von beiden Seiten mit einer Frist von zwei Wochen (§ 622 Abs. 3 BGB) gekündigt werden.

Nach Ablauf der Probezeit gelten die gesetzlichen Kündigungsfristen. Verlängert sich die Kündigungsfrist für die Firma aus tariflichen oder gesetzlichen Gründen, gilt diese Verlängerung auch für den Arbeitnehmer.

Das Recht zur fristlosen Kündigung aus wichtigem Grund bleibt hiervon unberührt.

Jede Kündigung hat schriftlich zu erfolgen.

Der Arbeitgeber ist berechtigt, den Arbeitnehmer nach Ausspruch einer Kündigung unter Fortzahlung der Vergütung und Anrechnung auf Resturlaubsansprüche von der Arbeitsleistung freizustellen.

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
