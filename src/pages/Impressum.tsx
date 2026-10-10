import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const Impressum = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="relative z-10 flex-grow pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8">Impressum</h1>
          
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Angaben gemäß § 5 TMG</h2>
            <p className="mb-2">EuroScent GmbH</p>
            <p className="mb-2">Königsallee 89</p>
            <p className="mb-2">D-40212 Düsseldorf</p>
            <p>Deutschland</p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Kontakt</h2>
            <p><strong>E-Mail:</strong> office@euroscent.de</p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Registereintrag</h2>
            <p className="mb-2"><strong>Eintragung im Handelsregister:</strong></p>
            <p className="mb-2">Registergericht: Amtsgericht Düsseldorf</p>
            <p>Registernummer: HRB 69139</p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Umsatzsteuer-ID</h2>
            <p className="mb-2">Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:</p>
            <p>DE152885038</p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Vertretungsberechtigte Personen</h2>
            <p className="mb-2"><strong>Geschäftsführer:</strong> Rolf Erwin Ruhfus</p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Haftungsausschluss</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">Haftung für Inhalte</h3>
            <p className="mb-4">
              Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht unter der Verpflichtung, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
            </p>
            <p className="mb-4">
              Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">Haftung für Links</h3>
            <p className="mb-4">
              Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar.
            </p>
            <p>
              Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Impressum;
