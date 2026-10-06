import { Button } from "@/components/ui/button";

const CTA = () => {
  return (
    <section className="relative z-10 py-20 md:py-32 bg-gradient-to-br from-primary/5 via-background to-primary/5">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
            Bereit, Ihre KYC-Prozesse zu optimieren?
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Starten Sie noch heute und profitieren Sie von unseren professionellen 
            KYC-Lösungen und Payment Provider Integrationen.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button variant="hero" size="lg" className="text-base" asChild>
              <a href="/auth">Kostenlos starten</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
