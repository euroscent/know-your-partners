import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin, Map, Navigation as NavigationIcon, Globe, Building2, Home,
  Briefcase, Calendar, CalendarDays, CalendarClock, Users, Building,
  Clock, Timer, Hourglass, CalendarCheck, CheckCircle, Circle,
  Cpu, Zap, Sparkles, Target, TrendingUp, Award, Star, BadgeCheck,
  Heart, Coffee, Smile, ThumbsUp
} from "lucide-react";

const iconCategories = [
  {
    category: "Standort-Icons",
    description: "Für die Angabe des Arbeitsorts",
    icons: [
      { name: "MapPin", Icon: MapPin, current: true },
      { name: "Map", Icon: Map },
      { name: "Navigation", Icon: NavigationIcon },
      { name: "Globe", Icon: Globe },
      { name: "Building2", Icon: Building2 },
      { name: "Home", Icon: Home },
    ]
  },
  {
    category: "Arbeitstyp-Icons",
    description: "Für Vollzeit/Teilzeit/etc.",
    icons: [
      { name: "Briefcase", Icon: Briefcase, current: true },
      { name: "Calendar", Icon: Calendar },
      { name: "CalendarDays", Icon: CalendarDays },
      { name: "CalendarClock", Icon: CalendarClock },
      { name: "Users", Icon: Users },
      { name: "Building", Icon: Building },
    ]
  },
  {
    category: "Zeit-Icons",
    description: "Für Ganztags/Arbeitszeit",
    icons: [
      { name: "Clock", Icon: Clock, current: true },
      { name: "Timer", Icon: Timer },
      { name: "Hourglass", Icon: Hourglass },
      { name: "CalendarCheck", Icon: CalendarCheck },
      { name: "CheckCircle", Icon: CheckCircle },
      { name: "Circle", Icon: Circle },
    ]
  },
  {
    category: "Modern/Tech-Style",
    description: "Moderne, technische Icons",
    icons: [
      { name: "Cpu", Icon: Cpu },
      { name: "Zap", Icon: Zap },
      { name: "Sparkles", Icon: Sparkles },
      { name: "Target", Icon: Target },
    ]
  },
  {
    category: "Business-Style",
    description: "Professionelle Business-Icons",
    icons: [
      { name: "TrendingUp", Icon: TrendingUp },
      { name: "Award", Icon: Award },
      { name: "Star", Icon: Star },
      { name: "BadgeCheck", Icon: BadgeCheck },
    ]
  },
  {
    category: "Casual-Style",
    description: "Freundliche, lockere Icons",
    icons: [
      { name: "Heart", Icon: Heart },
      { name: "Coffee", Icon: Coffee },
      { name: "Smile", Icon: Smile },
      { name: "ThumbsUp", Icon: ThumbsUp },
    ]
  }
];

const IconPicker = () => {
  const [selectedIcons, setSelectedIcons] = useState<Record<string, string>>({
    location: "MapPin",
    type: "Briefcase",
    time: "Clock"
  });

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <section className="relative z-10 py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                Icon-Auswahl für Stellenanzeigen
              </h1>
              <p className="text-lg text-muted-foreground">
                Wählen Sie die passenden Icons für Ihre Stellenanzeigen aus
              </p>
            </div>

            {/* Preview */}
            <Card className="p-8 mb-12 bg-muted/30">
              <h3 className="text-xl font-semibold mb-6 text-foreground">Vorschau:</h3>
              <div className="flex flex-wrap gap-6 text-muted-foreground">
                {(() => {
                  const LocationIcon = iconCategories[0].icons.find(i => i.name === selectedIcons.location)?.Icon || MapPin;
                  const TypeIcon = iconCategories[1].icons.find(i => i.name === selectedIcons.type)?.Icon || Briefcase;
                  const TimeIcon = iconCategories[2].icons.find(i => i.name === selectedIcons.time)?.Icon || Clock;
                  
                  return (
                    <>
                      <div className="flex items-center gap-2">
                        <LocationIcon className="h-5 w-5" />
                        <span>Nürnberg / Remote</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-5 w-5" />
                        <span>Vollzeit</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TimeIcon className="h-5 w-5" />
                        <span>Ganztags</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </Card>

            {/* Icon Categories */}
            <div className="space-y-12">
              {iconCategories.map((category, idx) => (
                <div key={idx}>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      {category.category}
                    </h2>
                    <p className="text-muted-foreground">{category.description}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                    {category.icons.map((icon, iconIdx) => {
                      const isSelected = 
                        (idx === 0 && selectedIcons.location === icon.name) ||
                        (idx === 1 && selectedIcons.type === icon.name) ||
                        (idx === 2 && selectedIcons.time === icon.name);
                      
                      return (
                        <Card 
                          key={iconIdx}
                          className={`p-6 cursor-pointer transition-all hover:shadow-[var(--shadow-medium)] ${
                            isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                          }`}
                          onClick={() => {
                            if (idx === 0) setSelectedIcons({...selectedIcons, location: icon.name});
                            if (idx === 1) setSelectedIcons({...selectedIcons, type: icon.name});
                            if (idx === 2) setSelectedIcons({...selectedIcons, time: icon.name});
                          }}
                        >
                          <div className="flex flex-col items-center gap-3">
                            <icon.Icon className="h-8 w-8 text-foreground" />
                            <div className="text-center">
                              <p className="text-sm font-medium text-foreground">
                                {icon.name}
                              </p>
                              {icon.current && (
                                <Badge variant="outline" className="mt-2 text-xs">
                                  Aktuell
                                </Badge>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Code Output */}
            <Card className="p-8 mt-12 bg-muted/30">
              <h3 className="text-xl font-semibold mb-4 text-foreground">
                Ihre Auswahl:
              </h3>
              <div className="space-y-2 font-mono text-sm bg-background p-4 rounded-lg border border-border">
                <p className="text-foreground">Standort: <span className="text-primary">{selectedIcons.location}</span></p>
                <p className="text-foreground">Arbeitstyp: <span className="text-primary">{selectedIcons.type}</span></p>
                <p className="text-foreground">Arbeitszeit: <span className="text-primary">{selectedIcons.time}</span></p>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Teilen Sie mir Ihre Auswahl mit, und ich ändere die Icons in den Stellenanzeigen!
              </p>
            </Card>

            <div className="mt-8 text-center">
              <Button variant="outline" size="lg" onClick={() => window.history.back()}>
                Zurück zu Karriere
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default IconPicker;
