import { useState, useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import eppLogoAsset from "@/assets/epp-logo.png.asset.json";

const Footer = () => {
  const [companyInfo, setCompanyInfo] = useState({
    company_name: "epp GmbH",
    street_address: "Kürschnershof 2",
    city: "Nürnberg",
    postal_code: "90403",
  });

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      const { data } = await supabase
        .from("company_contact")
        .select("company_name, street_address, city, postal_code")
        .limit(1)
        .maybeSingle();

      if (data) {
        setCompanyInfo({
          company_name: data.company_name || "epp GmbH",
          street_address: data.street_address || "Kürschnershof 2",
          city: data.city || "Nürnberg",
          postal_code: data.postal_code || "90403",
        });
      }
    };

    fetchCompanyInfo();
  }, []);

  return (
    <footer className="relative z-10 border-t border-border bg-card/40 py-16">
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src={eppLogoAsset.url} alt="EPP Logo" className="w-10 h-10 object-contain" />
              <span className="font-display text-xl font-extrabold tracking-tighter text-foreground">EPP</span>
            </div>
            <p className="text-xs font-medium tracking-[0.15em] uppercase text-primary mb-4">
              Engineering · Partnership · Possibilities
            </p>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Präzisions-engineered KYC- und Payment-Infrastruktur für den B2B-Finanzsektor.
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">{companyInfo.company_name}</p>
              <p>{companyInfo.street_address}</p>
              <p>D-{companyInfo.postal_code} {companyInfo.city}</p>
              <p className="pt-2">Amtsgericht Nürnberg</p>
              <p>HRB 38566</p>
            </div>
          </div>

          <div>
            <h4 className="font-display font-semibold text-foreground mb-4 text-sm uppercase tracking-wider">Solutions</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/services" className="hover:text-primary transition-colors">KYC-Verifizierung</a></li>
              <li><a href="/services" className="hover:text-primary transition-colors">Anbieter-Integration</a></li>
              <li><a href="/industries/payment-providers" className="hover:text-primary transition-colors">Payment Provider</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold text-foreground mb-4 text-sm uppercase tracking-wider">Branchen</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/industries/banking" className="hover:text-primary transition-colors">Bankwesen</a></li>
              <li><a href="/industries/crypto" className="hover:text-primary transition-colors">Krypto</a></li>
              <li><a href="/industries/marketplaces" className="hover:text-primary transition-colors">Marktplätze</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold text-foreground mb-4 text-sm uppercase tracking-wider">Unternehmen</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/partners" className="hover:text-primary transition-colors">Partnership</a></li>
              <li><a href="/careers" className="hover:text-primary transition-colors">Karriere</a></li>
              <li><a href="/contact" className="hover:text-primary transition-colors">Kontakt</a></li>
              <li><a href="/privacy" className="hover:text-primary transition-colors">Datenschutz</a></li>
              <li><a href="/impressum" className="hover:text-primary transition-colors">Impressum</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© 2026 epp GmbH. Alle Rechte vorbehalten.</p>
          <p className="font-display text-xs tracking-widest uppercase">EPP · Engineering. Partnership. Possibilities.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
