import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const Privacy = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      
      <section className="relative z-10 py-20 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-8">
            Datenschutzerklärung
          </h1>

          {/* Section 1 */}
          <div className="space-y-6 mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              1. Datenschutz auf einen Blick
            </h2>
            
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Allgemeine Hinweise
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen 
                Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen 
                Sie persönlich identifiziert werden können. Ausführliche Informationen zum Thema Datenschutz 
                entnehmen Sie unserer unter diesem Text aufgeführten Datenschutzerklärung.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Datenerfassung auf dieser Website
              </h3>
              
              <h4 className="text-lg font-semibold text-foreground mb-2">
                Wer ist verantwortlich für die Datenerfassung auf dieser Website?
              </h4>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten 
                können Sie dem Impressum dieser Website entnehmen.
              </p>

              <h4 className="text-lg font-semibold text-foreground mb-2">
                Wie erfassen wir Ihre Daten?
              </h4>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. Hierbei kann es sich 
                z. B. um Daten handeln, die Sie in ein Kontaktformular eingeben.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Andere Daten werden automatisch oder nach Ihrer Einwilligung beim Besuch der Website durch unsere 
                IT-Systeme erfasst. Das sind vor allem technische Daten (z. B. Internetbrowser, Betriebssystem oder 
                Uhrzeit des Seitenaufrufs). Die Erfassung dieser Daten erfolgt automatisch, sobald Sie diese Website 
                betreten.
              </p>

              <h4 className="text-lg font-semibold text-foreground mb-2">
                Wofür nutzen wir Ihre Daten?
              </h4>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Ein Teil der Daten wird erhoben, um eine fehlerfreie Bereitstellung der Website zu gewährleisten. 
                Andere Daten können zur Analyse Ihres Nutzerverhaltens verwendet werden.
              </p>

              <h4 className="text-lg font-semibold text-foreground mb-2">
                Welche Rechte haben Sie bezüglich Ihrer Daten?
              </h4>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Sie haben jederzeit das Recht, unentgeltlich Auskunft über Herkunft, Empfänger und Zweck Ihrer 
                gespeicherten personenbezogenen Daten zu erhalten. Sie haben außerdem ein Recht, die Berichtigung 
                oder Löschung dieser Daten zu verlangen. Wenn Sie eine Einwilligung zur Datenverarbeitung erteilt 
                haben, können Sie diese Einwilligung jederzeit für die Zukunft widerrufen. Außerdem haben Sie das 
                Recht, unter bestimmten Umständen die Einschränkung der Verarbeitung Ihrer personenbezogenen Daten 
                zu verlangen. Des Weiteren steht Ihnen ein Beschwerderecht bei der zuständigen Aufsichtsbehörde zu.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Hierzu sowie zu weiteren Fragen zum Thema Datenschutz können Sie sich jederzeit an uns wenden.
              </p>
            </div>
          </div>

          {/* Section 2 */}
          <div className="space-y-6 mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              2. Hosting
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Wir hosten die Inhalte unserer Website bei folgendem Anbieter:
            </p>

            <h3 className="text-xl font-semibold text-foreground mb-3">
              Externes Hosting
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Diese Website wird extern gehostet. Die personenbezogenen Daten, die auf dieser Website erfasst werden, 
              werden auf den Servern des Hosters gespeichert. Hierbei kann es sich v. a. um IP-Adressen, 
              Kontaktanfragen, Meta- und Kommunikationsdaten, Vertragsdaten, Kontaktdaten, Namen, Websitezugriffe 
              und sonstige Daten, die über eine Website generiert werden, handeln.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Das externe Hosting erfolgt zum Zwecke der Vertragserfüllung gegenüber unseren potenziellen und 
              bestehenden Kunden (Art. 6 Abs. 1 lit. b DSGVO) und im Interesse einer sicheren, schnellen und 
              effizienten Bereitstellung unseres Online-Angebots durch einen professionellen Anbieter (Art. 6 Abs. 1 
              lit. f DSGVO). Sofern eine entsprechende Einwilligung abgefragt wurde, erfolgt die Verarbeitung 
              ausschließlich auf Grundlage von Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TTDSG, soweit die 
              Einwilligung die Speicherung von Cookies oder den Zugriff auf Informationen im Endgerät des Nutzers 
              (z. B. Device-Fingerprinting) im Sinne des TTDSG umfasst. Die Einwilligung ist jederzeit widerrufbar.
            </p>
          </div>

          {/* Section 3 */}
          <div className="space-y-6 mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              3. Allgemeine Hinweise und Pflichtinformationen
            </h2>

            <div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Datenschutz
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre 
                personenbezogenen Daten vertraulich und entsprechend den gesetzlichen Datenschutzvorschriften sowie 
                dieser Datenschutzerklärung.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Wenn Sie diese Website benutzen, werden verschiedene personenbezogene Daten erhoben. Personenbezogene 
                Daten sind Daten, mit denen Sie persönlich identifiziert werden können. Die vorliegende 
                Datenschutzerklärung erläutert, welche Daten wir erheben und wofür wir sie nutzen. Sie erläutert auch, 
                wie und zu welchem Zweck das geschieht.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Wir weisen darauf hin, dass die Datenübertragung im Internet (z. B. bei der Kommunikation per E-Mail) 
                Sicherheitslücken aufweisen kann. Ein lückenloser Schutz der Daten vor dem Zugriff durch Dritte ist 
                nicht möglich.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Hinweis zur verantwortlichen Stelle
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:
              </p>
              <div className="bg-muted/30 p-6 rounded-lg mb-4">
                <p className="text-foreground font-semibold">epp GmbH</p>
                <p className="text-muted-foreground">Kürschnershof 2</p>
                <p className="text-muted-foreground">D-90403 Nürnberg</p>
                <p className="text-muted-foreground mt-3">E-Mail: datenschutz@payexpert.de.com</p>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Verantwortliche Stelle ist die natürliche oder juristische Person, die allein oder gemeinsam mit 
                anderen über die Zwecke und Mittel der Verarbeitung von personenbezogenen Daten (z. B. Namen, 
                E-Mail-Adressen o. Ä.) entscheidet.
              </p>
            </div>
          </div>

          {/* Section 4 */}
          <div className="space-y-6 mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              4. Datenerfassung auf dieser Website
            </h2>

            <div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Cookies
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Unsere Internetseiten verwenden so genannte "Cookies". Cookies sind kleine Datenpakete und richten auf 
                Ihrem Endgerät keinen Schaden an. Sie werden entweder vorübergehend für die Dauer einer Sitzung 
                (Session-Cookies) oder dauerhaft (permanente Cookies) auf Ihrem Endgerät gespeichert. Session-Cookies 
                werden nach Ende Ihres Besuchs automatisch gelöscht. Permanente Cookies bleiben auf Ihrem Endgerät 
                gespeichert, bis Sie diese selbst löschen oder eine automatische Löschung durch Ihren Webbrowser erfolgt.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Teilweise können auch Cookies von Drittunternehmen auf Ihrem Endgerät gespeichert werden, wenn Sie 
                unsere Seite betreten (Third-Party-Cookies). Diese ermöglichen uns oder Ihnen die Nutzung bestimmter 
                Dienstleistungen des Drittunternehmens (z. B. Cookies zur Abwicklung von Zahlungsdienstleistungen).
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Cookies haben verschiedene Funktionen. Zahlreiche Cookies sind technisch notwendig, da bestimmte 
                Websitefunktionen ohne diese nicht funktionieren würden (z. B. die Warenkorbfunktion oder die Anzeige 
                von Videos). Andere Cookies dienen dazu, das Nutzerverhalten auszuwerten oder Werbung anzuzeigen.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Cookies, die zur Durchführung des elektronischen Kommunikationsvorgangs, zur Bereitstellung bestimmter, 
                von Ihnen erwünschter Funktionen (z. B. für die Warenkorbfunktion) oder zur Optimierung der Website 
                (z. B. Cookies zur Messung des Webpublikums) erforderlich sind (notwendige Cookies), werden auf 
                Grundlage von Art. 6 Abs. 1 lit. f DSGVO gespeichert, sofern keine andere Rechtsgrundlage angegeben 
                wird. Der Websitebetreiber hat ein berechtigtes Interesse an der Speicherung von notwendigen Cookies 
                zur technisch fehlerfreien und optimierten Bereitstellung seiner Dienste. Sofern eine Einwilligung zur 
                Speicherung von Cookies und vergleichbaren Wiedererkennungstechnologien abgefragt wurde, erfolgt die 
                Verarbeitung ausschließlich auf Grundlage dieser Einwilligung (Art. 6 Abs. 1 lit. a DSGVO und § 25 
                Abs. 1 TTDSG); die Einwilligung ist jederzeit widerrufbar.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Sie können Ihren Browser so einstellen, dass Sie über das Setzen von Cookies informiert werden und 
                Cookies nur im Einzelfall erlauben, die Annahme von Cookies für bestimmte Fälle oder generell 
                ausschließen sowie das automatische Löschen der Cookies beim Schließen des Browsers aktivieren. Bei der 
                Deaktivierung von Cookies kann die Funktionalität dieser Website eingeschränkt sein.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Soweit Cookies von Drittunternehmen oder zu Analysezwecken eingesetzt werden, werden wir Sie hierüber 
                im Rahmen dieser Datenschutzerklärung gesondert informieren und ggf. eine Einwilligung abfragen.
              </p>
            </div>
          </div>

          {/* Section 5 */}
          <div className="space-y-6 mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              5. Plattform-spezifische Datenverarbeitung
            </h2>

            <div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Mitarbeiter-Dashboard
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Wenn Sie sich als Mitarbeiter auf unserer Plattform registrieren, erheben wir zusätzliche Daten, die 
                für die Durchführung der Arbeitsaufträge erforderlich sind. Dazu gehören:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4 ml-4">
                <li>Persönliche Identifikationsdaten (Name, Adresse, Geburtsdatum)</li>
                <li>Kontaktinformationen (E-Mail, Telefonnummer)</li>
                <li>Bankverbindung für Auszahlungen</li>
                <li>Arbeitszeiten und Leistungsdaten</li>
                <li>Kommunikationsdaten innerhalb der Plattform</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Diese Daten werden ausschließlich zur Vertragserfüllung und Abrechnung verwendet und nicht an Dritte 
                weitergegeben.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Aufgabenverwaltung
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Zur Verwaltung und Zuweisung von Arbeitsaufgaben speichern wir Informationen über:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4 ml-4">
                <li>Zugewiesene Aufgaben und deren Status</li>
                <li>Arbeitsfortschritt und Ergebnisse</li>
                <li>Kommunikation zwischen Mitarbeitern und Administratoren</li>
                <li>Zeiterfassung und Leistungsbewertungen</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-8">
            <p className="text-sm text-muted-foreground">
              Stand: {new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Privacy;
