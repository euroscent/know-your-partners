import { Link } from "react-router-dom";
import { CheckCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const ApplicationSuccess = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container max-w-2xl mx-auto px-4 py-20 flex flex-col items-center text-center">
        <div className="bg-primary/10 rounded-full p-6 mb-6">
          <CheckCircle className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Bewerbung erfolgreich eingereicht!</h1>
        <p className="text-muted-foreground text-lg mb-2">
          Vielen Dank für Ihre Bewerbung bei EuroScent.
        </p>
        <p className="text-muted-foreground mb-8">
          Wir haben Ihre Unterlagen erhalten und werden diese sorgfältig prüfen. 
          Sie erhalten in Kürze eine Bestätigungs-E-Mail an Ihre angegebene E-Mail-Adresse.
        </p>

        <div className="bg-muted rounded-xl p-6 w-full mb-8 text-left space-y-3">
          <p className="font-semibold text-foreground">Was passiert als Nächstes?</p>
          <ul className="space-y-2 text-muted-foreground text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">1.</span>
              Unser HR-Team prüft Ihre Bewerbungsunterlagen.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">2.</span>
              Bei positivem Feedback erhalten Sie eine Einladung per E-Mail.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">3.</span>
              Sie können sich dann in unserem System registrieren und loslegen.
            </li>
          </ul>
        </div>

        <Link to="/start">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Zurück zur Startseite
          </Button>
        </Link>
      </div>
      <Footer />
    </div>
  );
};

export default ApplicationSuccess;
