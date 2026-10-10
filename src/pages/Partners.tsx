import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import BouncingLogos from "@/components/BouncingLogos";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, TrendingUp, Shield, Award } from "lucide-react";
import partnersHero from "@/assets/partners-hero.jpg";
import fintechGroupLogo from "@/assets/fintech-group-logo.png";
import googleLogo from "@/assets/google-logo.png";
import authadaLogo from "@/assets/authada-logo.png";
import binanceLogo from "@/assets/binance-logo.png";
import postbankLogo from "@/assets/postbank-logo.png";
import webidLogo from "@/assets/webid-logo.png";

const Partners = () => {
  return (
    <div className="min-h-screen">
      <BouncingLogos />
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-secondary text-secondary-foreground py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Werden Sie Teil des EuroScent Partner-Programms
              </h1>
              <p className="text-lg md:text-xl opacity-90">
                Gemeinsam gestalten wir die Zukunft der KYC-Verifizierung. 
                Entdecken Sie, wie Sie von unserer Partnerschaft profitieren können.
              </p>
              <Button variant="hero" size="lg" asChild>
                <a href="/contact">Partner werden</a>
              </Button>
            </div>
            <div className="relative">
              <img 
                src={partnersHero}
                alt="Partner collaboration"
                className="rounded-2xl shadow-[var(--shadow-medium)] border border-border"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative z-10 py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-4">
              VORTEILE
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Warum mit EuroScent zusammenarbeiten?
            </h2>
            <p className="text-lg text-muted-foreground">
              EuroScent ist führend in der KYC-Verifizierung und Payment Provider-Integration. 
              Unsere Partner profitieren von erstklassiger Technologie, umfassender Unterstützung 
              und einem wachsenden Netzwerk.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="relative z-10 p-8 text-center border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="text-4xl font-bold text-primary mb-2">500K+</div>
              <p className="text-muted-foreground">Verifizierungen pro Monat</p>
            </Card>
            <Card className="relative z-10 p-8 text-center border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="text-4xl font-bold text-primary mb-2">99.9%</div>
              <p className="text-muted-foreground">Verfügbarkeit</p>
            </Card>
            <Card className="relative z-10 p-8 text-center border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="text-4xl font-bold text-primary mb-2">50+</div>
              <p className="text-muted-foreground">Integrierte Anbieter</p>
            </Card>
            <Card className="relative z-10 p-8 text-center border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="text-4xl font-bold text-primary mb-2">24/7</div>
              <p className="text-muted-foreground">Support verfügbar</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative z-10 py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-4">
              KUNDENSTIMMEN
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Das sagen unsere Partner
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            <Card className="relative z-10 p-8 border-border">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-foreground italic mb-4">
                    "Die Partnerschaft mit EuroScent war ein echter Gewinn! Die professionelle 
                    Integration ihrer KYC-Lösungen und die hervorragende technische Unterstützung 
                    haben unsere Compliance-Prozesse deutlich verbessert. Mehr Sicherheit und 
                    Effizienz – ein echtes Plus für unser Geschäft."
                  </p>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">Stefan Weber</p>
                    <p>Geschäftsführer, FinanceFlow GmbH</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="relative z-10 p-8 border-border">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-foreground italic mb-4">
                    "Das direkte Feedback durch die EuroScent KYC-Integration ist nicht nur eine 
                    Bestätigung unserer Compliance-Bemühungen, sondern auch ein wertvoller Ansporn, 
                    jeden Tag die höchsten Sicherheitsstandards zu gewährleisten."
                  </p>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">Wolfgang Nestler</p>
                    <p>Head of Compliance, SecureFinance AG</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="relative z-10 p-8 border-border">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-foreground italic mb-4">
                    "Durch EuroScent konnte unsere Firma effektiv authentische Kundenverifizierung 
                    durchführen. Dies schafft noch mehr Vertrauen bei unseren Kunden und gibt 
                    wertvolle Einblicke in die Compliance-Performance."
                  </p>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">Stefan Pritschet</p>
                    <p>CTO, PaymentTech Solutions GmbH</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="relative z-10 p-8 border-border">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-foreground italic mb-4">
                    "Die einfache Handhabung und die nachvollziehbaren Verifizierungsverfahren von 
                    EuroScent haben es uns erleichtert, das Vertrauen unserer Kunden zu gewinnen 
                    und zu erhalten. Ein unverzichtbares Tool für jedes wachsende FinTech!"
                  </p>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">André Schneider</p>
                    <p>Managing Director, CryptoBank GmbH</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="relative z-10 p-8 border-border">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-foreground italic mb-4">
                    "Als Payment Provider schätzen wir den Wert schneller und sicherer 
                    KYC-Verifizierung sehr. Dank EuroScent können wir unsere Verpflichtung zur 
                    Compliance und Kundensicherheit unterstreichen. So optimieren wir unsere 
                    Prozesse kontinuierlich."
                  </p>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">Florian Schmidinger</p>
                    <p>COO, QuickPay Europe GmbH</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="relative z-10 p-8 border-border">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-foreground italic mb-4">
                    "Seit wir EuroScent nutzen, hat sich unsere Position als vertrauenswürdiger 
                    Finanzdienstleister deutlich gefestigt. Die Möglichkeit, maßgeschneiderte 
                    KYC-Lösungen zu erhalten, war ein echter Gamechanger. Einfach super!"
                  </p>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">Verena Berger</p>
                    <p>CEO, Digital Banking Solutions</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Partnership Options */}
      <section className="relative z-10 py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-4">
              PARTNERSCHAFTSMODELLE
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Wege der Zusammenarbeit
            </h2>
            <p className="text-lg text-muted-foreground">
              Ob Sie ein Zahlungsanbieter, eine Compliance-Lösung oder ein Fintech-Unternehmen sind – 
              wir finden gemeinsam den besten Weg zum Wachstum.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="relative z-10 p-8 border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="mb-6 inline-flex p-4 rounded-lg bg-primary/10 text-primary">
                <TrendingUp className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-semibold text-card-foreground mb-4">
                Technologie-Partner
              </h3>
              <p className="text-muted-foreground mb-6">
                Erweitern Sie Ihr Produktportfolio durch vollständige Integration 
                unserer KYC-Lösungen und APIs in Ihre Plattform.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• API-Integration</li>
                <li>• White-Label-Lösungen</li>
                <li>• Technischer Support</li>
              </ul>
            </Card>

            <Card className="relative z-10 p-8 border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="mb-6 inline-flex p-4 rounded-lg bg-primary/10 text-primary">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-semibold text-card-foreground mb-4">
                Reseller-Partner
              </h3>
              <p className="text-muted-foreground mb-6">
                Erweitern Sie Ihr Lösungsportfolio und vertreiben Sie EuroScent-Produkte 
                ohne komplexe Integration.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Attraktive Margen</li>
                <li>• Sales-Unterstützung</li>
                <li>• Marketing-Materialien</li>
              </ul>
            </Card>

            <Card className="relative z-10 p-8 border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="mb-6 inline-flex p-4 rounded-lg bg-primary/10 text-primary">
                <Award className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-semibold text-card-foreground mb-4">
                Empfehlungs-Partner
              </h3>
              <p className="text-muted-foreground mb-6">
                Profitieren Sie von jeder erfolgreichen Empfehlung unserer 
                Lösungen an Endkunden.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Provisionsmodell</li>
                <li>• Einfache Abwicklung</li>
                <li>• Tracking-Dashboard</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Selected Partners */}
      <section className="relative z-10 py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-4">
              AUSGEWÄHLTE PARTNER
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Vertrauen von führenden Unternehmen
            </h2>
          </div>
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 items-center justify-items-center opacity-60">
            <div className="text-center">
              <img src={fintechGroupLogo} alt="fintech group" className="h-12 w-auto mx-auto grayscale hover:grayscale-0 transition-all" />
            </div>
            <div className="text-center">
              <img src={googleLogo} alt="Google" className="h-12 w-auto mx-auto grayscale hover:grayscale-0 transition-all" />
            </div>
            <div className="text-center">
              <img src={authadaLogo} alt="Authada" className="h-12 w-auto mx-auto grayscale hover:grayscale-0 transition-all" />
            </div>
            <div className="text-center">
              <img src={binanceLogo} alt="Binance" className="h-12 w-auto mx-auto grayscale hover:grayscale-0 transition-all" />
            </div>
            <div className="text-center">
              <img src={postbankLogo} alt="Postbank" className="h-12 w-auto mx-auto grayscale hover:grayscale-0 transition-all" />
            </div>
            <div className="text-center">
              <img src={webidLogo} alt="WebID" className="h-12 w-auto mx-auto grayscale hover:grayscale-0 transition-all" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
              Bereit für eine Partnerschaft?
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground">
              Lassen Sie uns gemeinsam wachsen und die Zukunft der KYC-Verifizierung gestalten.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button variant="hero" size="lg" className="text-base" asChild>
                <a href="/contact">Partnerschaft anfragen</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Partners;
