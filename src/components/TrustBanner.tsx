const TrustBanner = () => {
  const industries = ["Banking", "Crypto", "E-Commerce", "Insurance", "Lending", "Marketplaces", "Payment", "Travel"];
  
  return (
    <section className="border-y border-border bg-muted/30 py-12 overflow-hidden">
      <div className="container mx-auto px-4">
        <p className="text-center text-sm font-semibold tracking-wide text-muted-foreground uppercase mb-8">
          Vertrauenswürdige Partnerschaften in führenden Branchen
        </p>
        <div className="relative">
          <div className="flex animate-scroll">
            {/* First set of industries */}
            {industries.map((industry, index) => (
              <div key={`first-${index}`} className="flex-shrink-0 px-8 text-center opacity-60">
                <p className="text-sm font-semibold text-foreground whitespace-nowrap">{industry}</p>
              </div>
            ))}
            {/* Duplicate set for seamless loop */}
            {industries.map((industry, index) => (
              <div key={`second-${index}`} className="flex-shrink-0 px-8 text-center opacity-60">
                <p className="text-sm font-semibold text-foreground whitespace-nowrap">{industry}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustBanner;
