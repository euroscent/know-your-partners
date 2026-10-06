import { Shield, Mail, Lock, KeyRound, Phone } from "lucide-react";

interface BrandColors {
  primary: string;
  secondary: string;
  accent?: string;
}

interface DemoConsoleLivePreviewProps {
  brandColors: BrandColors;
  logoUrl?: string | null;
  taskTitle?: string;
}

/**
 * Compact preview of the Demo Console with extracted branding.
 * Uses the brand colors prominently for the background and accents.
 */
export const DemoConsoleLivePreview = ({
  brandColors,
  logoUrl,
  taskTitle = "Demo Auftrag",
}: DemoConsoleLivePreviewProps) => {
  // Helper: Get luminance to determine if color is "light" or "dark"
  const getLuminance = (hex: string): number => {
    const h = (hex || "").replace("#", "");
    if (h.length !== 6) return 0.5;
    const rgb = h.match(/.{2}/g);
    if (!rgb) return 0.5;
    const [r, g, b] = rgb.map((c) => {
      const val = parseInt(c, 16) / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  // Helper: convert HEX -> "H S% L%" string usable in: hsl(var(--x) / a)
  const hexToHslVar = (hex: string): string => {
    const h = (hex || "").replace("#", "");
    if (h.length !== 6) return "0 0% 50%";

    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let hue = 0;
    if (delta !== 0) {
      if (max === r) hue = ((g - b) / delta) % 6;
      else if (max === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
      hue = Math.round(hue * 60);
      if (hue < 0) hue += 360;
    }

    const light = (max + min) / 2;
    const sat = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));

    const s = Math.round(sat * 100);
    const l = Math.round(light * 100);

    return `${hue} ${s}% ${l}%`;
  };

  // Darken a color for better contrast
  const darkenHsl = (hslVar: string, amount: number): string => {
    const match = hslVar.match(/^([0-9]+)\s+([0-9]+)%\s+([0-9]+)%$/);
    if (!match) return hslVar;
    const [, h, s, l] = match;
    const newL = Math.max(0, Number(l) - amount);
    return `${h} ${s}% ${newL}%`;
  };

  const colors = brandColors;
  const primaryHsl = hexToHslVar(colors.primary);
  const secondaryHsl = hexToHslVar(colors.secondary);
  const accentHsl = hexToHslVar(colors.accent || colors.primary);

  const primaryLuminance = getLuminance(colors.primary);
  const isLightPrimary = primaryLuminance > 0.4;

  // Create darker versions for background
  const bgDarkHsl = darkenHsl(primaryHsl, isLightPrimary ? 35 : 15);
  const bgMediumHsl = darkenHsl(primaryHsl, isLightPrimary ? 25 : 8);

  // Row background - slightly lighter than main bg
  const rowBgHsl = darkenHsl(primaryHsl, isLightPrimary ? 20 : 5);

  // Text colors based on background
  const textColor = "rgb(248 250 252)"; // slate-50
  const textMuted = "rgb(148 163 184)"; // slate-400

  const brandVars: React.CSSProperties = {
    ["--brand-primary" as any]: primaryHsl,
    ["--brand-secondary" as any]: secondaryHsl,
    ["--brand-accent" as any]: accentHsl,
    ["--brand-bg-dark" as any]: bgDarkHsl,
    ["--brand-bg-medium" as any]: bgMediumHsl,
    ["--brand-row-bg" as any]: rowBgHsl,
  };

  // Barcode pattern
  const barcodePattern = Array.from({ length: 20 }, (_, i) =>
    (i * 7 + 3) % 5 === 0 ? 3 : (i * 11 + 7) % 3 === 0 ? 2 : 1
  );

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl shadow-lg text-left"
      style={{
        ...brandVars,
        background: `linear-gradient(145deg, hsl(${bgDarkHsl}) 0%, hsl(${bgMediumHsl}) 50%, hsl(${bgDarkHsl}) 100%)`,
        borderWidth: "1px",
        borderColor: `hsl(${secondaryHsl} / 0.4)`,
      }}
    >
      {/* Accent Stripe - uses secondary/accent */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: `hsl(${accentHsl})` }}
      />

      {/* Header */}
      <div
        className="relative px-3 py-2 border-b flex items-center gap-2"
        style={{ borderColor: `hsl(${secondaryHsl} / 0.25)` }}
      >
        {logoUrl ? (
          <div
            className="w-8 h-8 rounded-md overflow-hidden border flex-shrink-0 bg-white"
            style={{ borderColor: `hsl(${secondaryHsl} / 0.5)` }}
          >
            <img 
              src={logoUrl} 
              alt="Logo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.dataset.fallbackAttempted) {
                  target.dataset.fallbackAttempted = 'true';
                  target.style.display = 'none';
                }
              }}
            />
          </div>
        ) : (
          <div
            className="p-1.5 rounded-md border"
            style={{
              background: `linear-gradient(135deg, hsl(${secondaryHsl} / 0.25), transparent)`,
              borderColor: `hsl(${secondaryHsl} / 0.4)`,
            }}
          >
            <Shield className="h-4 w-4" style={{ color: `hsl(${secondaryHsl})` }} />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-[10px] font-bold tracking-wide uppercase truncate" style={{ color: textColor }}>
            Zugangsdaten
          </h3>
          <p className="text-[9px] truncate" style={{ color: textMuted }}>{taskTitle}</p>
        </div>
        <div
          className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded-full border"
          style={{
            backgroundColor: `hsl(${secondaryHsl} / 0.15)`,
            borderColor: `hsl(${secondaryHsl} / 0.4)`,
          }}
        >
          <div
            className="h-1 w-1 rounded-full animate-pulse"
            style={{ backgroundColor: `hsl(${secondaryHsl})` }}
          />
          <span className="text-[8px] font-semibold uppercase" style={{ color: `hsl(${secondaryHsl})` }}>
            Aktiv
          </span>
        </div>
      </div>

      {/* Demo Credentials - Placeholder Rows */}
      <div className="relative p-3 space-y-1.5">
        <PreviewRow 
          icon={<Mail className="h-3 w-3 text-blue-400" />} 
          label="E-Mail" 
          value="demo@example.com" 
          rowBg={`hsl(${rowBgHsl} / 0.6)`}
          borderColor={`hsl(${secondaryHsl} / 0.2)`}
          textColor={textColor}
          textMuted={textMuted}
        />
        <PreviewRow 
          icon={<Lock className="h-3 w-3 text-rose-400" />} 
          label="Passwort" 
          value="••••••••" 
          rowBg={`hsl(${rowBgHsl} / 0.6)`}
          borderColor={`hsl(${secondaryHsl} / 0.2)`}
          textColor={textColor}
          textMuted={textMuted}
        />
        <PreviewRow 
          icon={<KeyRound className="h-3 w-3 text-orange-400" />} 
          label="Passcode" 
          value="1234" 
          rowBg={`hsl(${rowBgHsl} / 0.6)`}
          borderColor={`hsl(${secondaryHsl} / 0.2)`}
          textColor={textColor}
          textMuted={textMuted}
        />
        <PreviewRow 
          icon={<Phone className="h-3 w-3 text-green-400" />} 
          label="Telefon" 
          value="+49 123 456789" 
          rowBg={`hsl(${rowBgHsl} / 0.6)`}
          borderColor={`hsl(${secondaryHsl} / 0.2)`}
          textColor={textColor}
          textMuted={textMuted}
        />
      </div>

      {/* Footer Barcode */}
      <div
        className="relative px-3 py-1.5 border-t flex items-center gap-[1px]"
        style={{ 
          borderColor: `hsl(${secondaryHsl} / 0.2)`,
          backgroundColor: `hsl(${bgDarkHsl} / 0.7)`,
        }}
      >
        {barcodePattern.map((width, i) => (
          <div
            key={i}
            style={{
              width: `${width}px`,
              opacity: 0.3 + ((i * 17) % 10) / 20,
              backgroundColor: `hsl(${secondaryHsl})`,
            }}
            className="h-3 rounded-[0.5px]"
          />
        ))}
        <span className="ml-auto text-[8px] font-mono" style={{ color: textMuted }}>PREVIEW</span>
      </div>
    </div>
  );
};

const PreviewRow = ({
  icon,
  label,
  value,
  rowBg,
  borderColor,
  textColor,
  textMuted,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  rowBg: string;
  borderColor: string;
  textColor: string;
  textMuted: string;
}) => (
  <div 
    className="flex items-center gap-2 rounded-md px-2 py-1 border"
    style={{ backgroundColor: rowBg, borderColor }}
  >
    <div 
      className="p-1 rounded border"
      style={{ backgroundColor: `${rowBg}`, borderColor }}
    >
      {icon}
    </div>
    <span className="text-[10px] w-14 truncate" style={{ color: textMuted }}>{label}</span>
    <span className="text-[10px] font-mono truncate" style={{ color: textColor }}>{value}</span>
  </div>
);
