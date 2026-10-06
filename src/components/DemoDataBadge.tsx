import { useState, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mail, User, Lock, KeyRound, Link2, Info, Copy, Check, Shield, 
  Phone, Eye, Image, Loader2, Zap, Terminal, ExternalLink, Server, Database, Wifi, X, ZoomIn, ChevronLeft, ChevronRight, FileText, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/lib/toast-stub";

interface BrandColors {
  primary: string;
  secondary: string;
  accent?: string;
}

interface DemoDataBadgeProps {
  data: {
    email?: string;
    username?: string;
    password?: string;
    passcode?: string;
    ident_code?: string;
    ident_codes?: string[];
    ident_link?: string;
    info?: string;
    image_url?: string;
    image_urls?: string[];
    image_names?: string[];
    phone_number?: string;
    sms_code?: string;
  };
  taskId?: string;
  taskTitle?: string;
  taskImageUrl?: string;
  taskImages?: string[]; // Multiple images for slideshow
  brandColors?: BrandColors;
  emailCodeSlot?: ReactNode;
  smsCodeSlot?: ReactNode;
  appStoreSlot?: ReactNode;
  onCopyValue?: (value: string, label: string) => void;
}

export const DemoDataBadge = ({ 
  data, 
  taskId, 
  taskTitle,
  taskImageUrl,
  taskImages = [],
  brandColors,
  emailCodeSlot,
  smsCodeSlot,
  appStoreSlot,
  onCopyValue
}: DemoDataBadgeProps) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [bootPhase, setBootPhase] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [uploadedImageIndex, setUploadedImageIndex] = useState(0);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [bootImageLoaded, setBootImageLoaded] = useState(false);

  const openImageModal = (imageUrl: string) => {
    setModalImageUrl(imageUrl);
    setImageModalOpen(true);
  };

  // Build images array for logo slideshow: ONLY taskImages and taskImageUrl (NOT data.image_url which is admin upload)
  const allImages = (() => {
    const images: string[] = [];
    // Multiple task images (logo/branding images)
    if (taskImages.length > 0) images.push(...taskImages);
    // Single task image if not already included
    if (taskImageUrl && !images.includes(taskImageUrl)) images.push(taskImageUrl);
    return images;
  })();
  const hasMultipleImages = allImages.length > 1;

  // Image slideshow effect: cycle every 5-8 seconds (random interval)
  useEffect(() => {
    if (!hasMultipleImages || !showContent) return;
    
    const cycleImage = () => {
      setCurrentImageIndex(prev => (prev + 1) % allImages.length);
    };
    
    // Random interval between 5000ms and 8000ms
    const getRandomInterval = () => 5000 + Math.random() * 3000;
    
    let timeoutId: number;
    const scheduleNext = () => {
      timeoutId = window.setTimeout(() => {
        cycleImage();
        scheduleNext();
      }, getRandomInterval());
    };
    
    scheduleNext();
    
    return () => window.clearTimeout(timeoutId);
  }, [hasMultipleImages, showContent, allImages.length]);

  // Get current image URL
  const currentImageUrl = allImages[currentImageIndex] || null;

  // Default fallback colors - modern teal/slate
  const defaultColors: BrandColors = {
    primary: '#0ea5e9',
    secondary: '#64748b',
    accent: '#06b6d4'
  };

  const colors = brandColors || defaultColors;

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

  // Determine the "visible" brand color - pick the darkest for visibility on dark backgrounds
  const primaryLuminance = getLuminance(colors.primary);
  const secondaryLuminance = getLuminance(colors.secondary);
  const accentLuminance = getLuminance(colors.accent || colors.primary);

  const featureColorHex = (() => {
    const candidates = [
      { color: colors.accent || colors.primary, lum: accentLuminance },
      { color: colors.primary, lum: primaryLuminance },
      { color: colors.secondary, lum: secondaryLuminance },
    ];
    candidates.sort((a, b) => a.lum - b.lum);
    const visible = candidates.find((c) => c.lum > 0.03 && c.lum < 0.7) || candidates[0];
    return visible.color;
  })();

  // If all colors are very light: keep the hue/saturation, but clamp lightness for contrast
  const allColorsLight =
    primaryLuminance > 0.6 && secondaryLuminance > 0.6 && accentLuminance > 0.6;

  const featureHsl = hexToHslVar(featureColorHex);
  const accentVisibleHsl = (() => {
    const match = featureHsl.match(/^([0-9]+)\s+([0-9]+)%\s+([0-9]+)%$/);
    if (!match) return featureHsl;
    const [, h, s, l] = match;
    const light = Number(l);
    const clampedL = allColorsLight ? Math.min(light, 55) : Math.min(light, 60);
    const finalL = Math.max(clampedL, 22);
    return `${h} ${s}% ${finalL}%`;
  })();

  // Calculate dynamic background colors based on primary color (for brand-themed console)
  const primaryHsl = hexToHslVar(colors.primary);
  const primaryHslMatch = primaryHsl.match(/^([0-9]+)\s+([0-9]+)%\s+([0-9]+)%$/);
  const primaryH = primaryHslMatch ? parseInt(primaryHslMatch[1]) : 222;
  const primaryS = primaryHslMatch ? parseInt(primaryHslMatch[2]) : 47;

  // Create dark backgrounds using the brand hue
  const bgDarkHsl = `${primaryH} ${Math.max(primaryS - 20, 15)}% 11%`;
  const bgMediumHsl = `${primaryH} ${Math.max(primaryS - 15, 12)}% 14%`;
  const rowBgHsl = `${primaryH} ${Math.max(primaryS - 18, 10)}% 16%`;

  const brandVars: React.CSSProperties = {
    // CSS variables for per-task tinting
    ['--brand-primary' as any]: hexToHslVar(colors.primary),
    ['--brand-secondary' as any]: hexToHslVar(colors.secondary),
    ['--brand-accent' as any]: hexToHslVar(colors.accent || colors.primary),
    ['--brand-accent-visible' as any]: accentVisibleHsl,
    // Dynamic console background colors based on brand hue
    ['--console-bg-dynamic' as any]: bgDarkHsl,
    ['--console-panel-dynamic' as any]: bgMediumHsl,
    ['--console-row-dynamic' as any]: rowBgHsl,
  };

  // Preload boot image first
  useEffect(() => {
    if (!currentImageUrl) {
      setBootImageLoaded(true);
      return;
    }
    setBootImageLoaded(false);
    const img = new window.Image();
    img.onload = () => setBootImageLoaded(true);
    img.onerror = () => setBootImageLoaded(true);
    img.src = currentImageUrl;
    // Safety timeout (max 4s wait)
    const t = setTimeout(() => setBootImageLoaded(true), 4000);
    return () => clearTimeout(t);
  }, [currentImageUrl]);

  // Boot sequence animation - only after image is ready
  useEffect(() => {
    if (!bootImageLoaded) return;

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const phases = [
      { delay: 400, phase: 1 },
      { delay: 900, phase: 2 },
      { delay: 1500, phase: 3 },
      { delay: 2200, phase: 4 },
    ];

    phases.forEach(({ delay, phase }) => {
      timeouts.push(setTimeout(() => setBootPhase(phase), delay));
    });

    timeouts.push(setTimeout(() => setShowContent(true), 2600));
    timeouts.push(setTimeout(() => setIsExpanded(true), 3000));

    return () => timeouts.forEach(clearTimeout);
  }, [bootImageLoaded]);

  const copyToClipboard = async (value: string, fieldName: string, label?: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(fieldName);
    if (onCopyValue) {
      onCopyValue(value, label || fieldName);
    } else {
      toast.success(`${label || fieldName} kopiert!`);
    }
    setTimeout(() => setCopiedField(null), 2000);
  };

  const allIdentCodes = data.ident_codes?.filter(c => c.trim()) ?? (data.ident_code ? [data.ident_code] : []);
  const allUploadedRaw = data.image_urls?.filter(u => u) ?? (data.image_url ? [data.image_url] : []);
  const uploadedNames = data.image_names ?? [];
  const isPdfUrl = (url: string, idx: number) => {
    if (!url) return false;
    if (url.startsWith("data:application/pdf")) return true;
    const name = uploadedNames[idx];
    if (name && name.toLowerCase().endsWith(".pdf")) return true;
    if (url.toLowerCase().split("?")[0].endsWith(".pdf")) return true;
    return false;
  };
  const allUploadedImages = allUploadedRaw.filter((u, i) => !isPdfUrl(u, i));
  const allUploadedPdfs = allUploadedRaw
    .map((u, i) => ({ url: u, name: uploadedNames[i] || `Dokument-${i + 1}.pdf`, originalIndex: i }))
    .filter(p => isPdfUrl(p.url, p.originalIndex));
  const hasMultipleUploadedImages = allUploadedImages.length > 1;

  const handleDownloadPdf = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  const hasAnyData = data.email || data.username || data.password || data.passcode || data.ident_link || allIdentCodes.length > 0 || data.phone_number || allUploadedImages.length > 0 || allUploadedPdfs.length > 0;

  // Generate barcode pattern
  const barcodePattern = Array.from({ length: 35 }, (_, i) => 
    (i * 7 + 3) % 5 === 0 ? 3 : (i * 11 + 7) % 3 === 0 ? 2 : 1
  );

  const bootMessages = [
    { phase: 1, text: "Verbinde mit Server...", icon: Wifi },
    { phase: 2, text: "Authentifiziere...", icon: Shield },
    { phase: 3, text: "Lade Demo-Daten...", icon: Database },
    { phase: 4, text: "Bereit", icon: Check },
  ];

  return (
    <div className="relative w-full max-w-2xl mx-auto" style={brandVars}>

      {/* Fullscreen Boot Overlay */}
      <AnimatePresence>
        {!showContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            style={{
              background: `radial-gradient(ellipse at 50% 30%, hsl(var(--brand-primary) / 0.25) 0%, transparent 60%), 
                           radial-gradient(ellipse at 80% 80%, hsl(var(--brand-secondary) / 0.18) 0%, transparent 50%),
                           linear-gradient(180deg, hsl(var(--console-bg-dynamic)) 0%, hsl(${primaryH} ${Math.max(primaryS - 25, 10)}% 8%) 100%)`
            }}
          >
            {/* Large Logo Display */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mb-6"
            >
              {currentImageUrl ? (
                <div
                  className="w-32 h-32 rounded-2xl overflow-hidden border-2 shadow-2xl"
                  style={{ 
                    borderColor: "hsl(var(--brand-accent-visible) / 0.5)",
                    boxShadow: `0 0 60px hsl(var(--brand-accent-visible) / 0.3)`
                  }}
                >
                  <img
                    src={currentImageUrl}
                    alt={taskTitle || "Task"}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div
                  className="w-32 h-32 rounded-2xl border-2 flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--brand-accent-visible) / 0.2), transparent)",
                    borderColor: "hsl(var(--brand-accent-visible) / 0.5)",
                    boxShadow: `0 0 60px hsl(var(--brand-accent-visible) / 0.3)`
                  }}
                >
                  <Shield className="h-16 w-16" style={{ color: "hsl(var(--brand-accent-visible))" }} />
                </div>
              )}
            </motion.div>

            {/* Task Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-2xl font-bold text-white mb-2"
            >
              {taskTitle || "Verbinde..."}
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-xs uppercase tracking-[0.3em] mb-8"
              style={{ color: "hsl(var(--brand-accent-visible) / 0.7)" }}
            >
              Secure Connection
            </motion.p>

            {/* Small Console Boot Screen - slides up */}
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
              className="w-full max-w-sm rounded-xl border overflow-hidden"
              style={{
                background: `linear-gradient(145deg, hsl(var(--console-bg-dynamic)) 0%, hsl(var(--console-panel-dynamic)) 100%)`,
                borderColor: "hsl(var(--brand-accent-visible) / 0.3)",
              }}
            >
              <div className="px-4 py-3 space-y-2">
                {bootMessages.map((msg, idx) => (
                  <motion.div
                    key={msg.phase}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ 
                      opacity: bootPhase >= msg.phase ? 1 : 0.3, 
                      x: 0 
                    }}
                    transition={{ delay: 0.5 + idx * 0.15, duration: 0.3 }}
                    className="flex items-center gap-3 font-mono text-sm"
                  >
                    <span style={{ color: "hsl(var(--brand-accent-visible))" }}>&gt;</span>
                    <msg.icon 
                      className={`h-4 w-4 ${bootPhase === msg.phase && bootPhase < 4 ? 'animate-pulse' : ''}`}
                      style={{ 
                        color: bootPhase >= msg.phase 
                          ? "hsl(var(--brand-accent-visible))" 
                          : "hsl(var(--brand-accent-visible) / 0.4)" 
                      }}
                    />
                    <span className={bootPhase >= msg.phase ? "text-slate-200" : "text-slate-500"}>
                      {msg.text}
                    </span>
                    {bootPhase > msg.phase && (
                      <Check className="h-4 w-4 ml-auto" style={{ color: "hsl(var(--brand-accent-visible))" }} />
                    )}
                    {bootPhase === msg.phase && msg.phase < 4 && (
                      <Loader2 
                        className="h-4 w-4 ml-auto animate-spin" 
                        style={{ color: "hsl(var(--brand-accent-visible))" }} 
                      />
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Badge Content - starts collapsed, expands after boot */}
      <motion.div
        initial={{ opacity: 0, height: 100 }}
        animate={{ 
          opacity: showContent ? 1 : 0,
          height: isExpanded ? "auto" : 100
        }}
        transition={{ 
          opacity: { duration: 0.4 },
          height: { duration: 0.8, ease: [0.32, 0.72, 0, 1] }
        }}
        className="relative rounded-2xl shadow-2xl flex flex-col"
        style={{
          background:
            `radial-gradient(900px circle at 18% 0%, hsl(var(--brand-primary) / 0.22), transparent 55%), radial-gradient(800px circle at 90% 55%, hsl(var(--brand-secondary) / 0.16), transparent 60%), linear-gradient(145deg, hsl(var(--console-bg-dynamic)) 0%, hsl(var(--console-panel-dynamic)) 50%, hsl(var(--console-bg-dynamic)) 100%)`,
          borderWidth: "1px",
          borderColor: "hsl(var(--brand-accent-visible) / 0.28)",
          maxHeight: isExpanded ? "70vh" : 100,
          overflow: "hidden",
        }}
      >
        {/* Dynamic accent stripe using visible brand color */}
        <div
          className="absolute top-0 left-0 right-0 h-1 z-10"
          style={{ backgroundColor: "hsl(var(--brand-accent-visible))" }}
        />
        
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)`
          }} />
        </div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className={`flex-1 overflow-y-auto overflow-x-hidden flex flex-col ${isExpanded ? '' : 'overflow-hidden'}`}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'hsl(var(--brand-accent-visible) / 0.4) transparent'
          }}
        >

        {/* Compact Header with Task Image */}
        <div
          className="relative px-4 py-3 border-b"
          style={{ borderColor: "hsl(var(--brand-accent-visible) / 0.2)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentImageUrl ? (
                <div
                  className="relative w-10 h-10 rounded-lg overflow-hidden border flex-shrink-0 cursor-pointer group/image"
                  style={{ borderColor: "hsl(var(--brand-accent-visible) / 0.45)" }}
                  onClick={() => openImageModal(currentImageUrl)}
                >
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={currentImageUrl}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      src={currentImageUrl}
                      alt={taskTitle || "Task"}
                      className="w-full h-full object-cover"
                    />
                  </AnimatePresence>
                  {/* Zoom overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="h-4 w-4 text-white" />
                  </div>
                </div>
              ) : (
                <div
                  className="p-1.5 rounded-lg border"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--brand-accent-visible) / 0.18), transparent)",
                    borderColor: "hsl(var(--brand-accent-visible) / 0.35)",
                  }}
                >
                  <Shield
                    className="h-4 w-4"
                    style={{ color: "hsl(var(--brand-accent-visible))" }}
                  />
                </div>
              )}
              <div>
                <h3 className="text-xs font-bold tracking-wide text-slate-100 uppercase">
                  Zugangsdaten
                </h3>
                {taskTitle && (
                  <p className="text-[10px] text-slate-400 truncate max-w-[160px]">
                    {taskTitle}
                  </p>
                )}
              </div>
            </div>
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-full border"
              style={{
                backgroundColor: "hsl(var(--brand-accent-visible) / 0.12)",
                borderColor: "hsl(var(--brand-accent-visible) / 0.35)",
              }}
            >
              <div
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: "hsl(var(--brand-accent-visible))" }}
              />
              <span
                className="text-[10px] font-semibold uppercase"
                style={{ color: "hsl(var(--brand-accent-visible))" }}
              >
                Aktiv
              </span>
            </div>
          </div>
        </div>

        {/* App Store + Info Section - Compact */}
        {(appStoreSlot || data.info) && (
          <div className="relative px-4 py-3 border-b border-slate-700/50 bg-slate-800/30">
            {data.info && (
              <div className="flex items-start gap-2 mb-3" data-tour-id="info">
                <Info className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-slate-300 leading-relaxed space-y-2 whitespace-pre-line [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:text-slate-100 [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-slate-100 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-slate-100 [&_h3]:font-semibold [&_h3]:text-slate-100">
                  {/<[a-z][\s\S]*>/i.test(data.info) ? (
                    <div dangerouslySetInnerHTML={{ __html: data.info }} />
                  ) : (
                    data.info.split(/\n{2,}/).map((para, i) => (
                      <p key={i} className="whitespace-pre-line">{para.trim()}</p>
                    ))
                  )}
                </div>
              </div>
            )}
            {appStoreSlot && <div data-tour-id="appStore">{appStoreSlot}</div>}
          </div>
        )}

        {/* Main Content - Compact Grid */}
        <div className="relative p-4">
          {hasAnyData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Email + Code */}
              {data.email && (
                <div className="sm:col-span-2" data-tour-id="email">
                  <CompactCredentialRow
                    icon={<Mail className="h-3.5 w-3.5" />}
                    iconColor="text-blue-400"
                    iconBg="bg-blue-500/20 border-blue-500/30"
                    label="E-Mail"
                    value={data.email}
                    onCopy={() => copyToClipboard(data.email!, "email", "E-Mail")}
                    isCopied={copiedField === "email"}
                  />
                  {emailCodeSlot && <div className="mt-2 ml-6">{emailCodeSlot}</div>}
                </div>
              )}

              {/* Password */}
              {data.password && (
                <div data-tour-id="password"><CompactCredentialRow
                  icon={<Lock className="h-3.5 w-3.5" />}
                  iconColor="text-rose-400"
                  iconBg="bg-rose-500/20 border-rose-500/30"
                  label="Passwort"
                  value={data.password}
                  onCopy={() => copyToClipboard(data.password!, "password", "Passwort")}
                  isCopied={copiedField === "password"}
                /></div>
              )}

              {/* Username */}
              {data.username && (
                <div data-tour-id="username"><CompactCredentialRow
                  icon={<User className="h-3.5 w-3.5" />}
                  iconColor="text-violet-400"
                  iconBg="bg-violet-500/20 border-violet-500/30"
                  label="Benutzername"
                  value={data.username}
                  onCopy={() => copyToClipboard(data.username!, "username", "Benutzername")}
                  isCopied={copiedField === "username"}
                /></div>
              )}

              {/* Passcode */}
              {data.passcode && (
                <div data-tour-id="passcode"><CompactCredentialRow
                  icon={<KeyRound className="h-3.5 w-3.5" />}
                  iconColor="text-orange-400"
                  iconBg="bg-orange-500/20 border-orange-500/30"
                  label="Passcode"
                  value={data.passcode}
                  onCopy={() => copyToClipboard(data.passcode!, "passcode", "Passcode")}
                  isCopied={copiedField === "passcode"}
                  highlight
                /></div>
              )}

              {/* SMS Code - removed duplicate, now only shown via smsCodeSlot under phone */}

              {/* Phone + SMS Slot */}
              {data.phone_number && (
                <div className="sm:col-span-2" data-tour-id="phone">
                  <CompactCredentialRow
                    icon={<Phone className="h-3.5 w-3.5" />}
                    iconColor="text-green-400"
                    iconBg="bg-green-500/20 border-green-500/30"
                    label="Telefon"
                    value={data.phone_number}
                    onCopy={() => copyToClipboard(data.phone_number!, "phone", "Telefonnummer")}
                    isCopied={copiedField === "phone"}
                  />
                  {smsCodeSlot && <div className="mt-2 ml-6">{smsCodeSlot}</div>}
                </div>
              )}

              {/* Ident Codes - Prominent */}
              {allIdentCodes.length > 0 && (
                <div className="sm:col-span-2 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-xl p-3 border border-emerald-500/30" data-tour-id="identCode">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1 rounded-md bg-emerald-500/20 border border-emerald-500/30">
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <span className="text-xs font-semibold text-slate-200">
                      {allIdentCodes.length > 1 ? `Ident-Codes (${allIdentCodes.length})` : "Ident-Code"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {allIdentCodes.map((code, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-900/80 rounded-lg px-3 py-2 border border-emerald-500/30 font-mono text-xl font-bold text-center text-emerald-300 tracking-widest">
                          {allIdentCodes.length > 1 && (
                            <span className="text-xs text-emerald-500/60 font-sans font-normal tracking-normal mr-2">#{index + 1}</span>
                          )}
                          {code}
                        </div>
                        <CopyButton 
                          onClick={() => copyToClipboard(code, `ident_code_${index}`, `Ident-Code ${allIdentCodes.length > 1 ? index + 1 : ""}`)}
                          isCopied={copiedField === `ident_code_${index}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Image Preview - Gallery with Swipe */}
              {allUploadedImages.length > 0 && (
                <div className="sm:col-span-2 bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-blue-500/10 rounded-xl p-4 border border-pink-500/30">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-md bg-gradient-to-br from-pink-500/30 to-purple-500/30 border border-pink-500/40">
                      <Image className="h-4 w-4 text-pink-400" />
                    </div>
                    {hasMultipleUploadedImages && (
                      <span className="text-sm font-semibold text-slate-200">
                        {`Bilder (${uploadedImageIndex + 1}/${allUploadedImages.length})`}
                      </span>
                    )}
                  </div>
                  <div
                    className="relative bg-slate-900/80 rounded-lg p-2 border border-pink-500/20 overflow-hidden cursor-pointer group/uploadimg"
                    onClick={() => openImageModal(allUploadedImages[uploadedImageIndex])}
                    onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
                    onTouchEnd={(e) => {
                      if (touchStartX === null || !hasMultipleUploadedImages) return;
                      const diff = touchStartX - e.changedTouches[0].clientX;
                      if (Math.abs(diff) > 50) {
                        if (diff > 0) setUploadedImageIndex(prev => Math.min(prev + 1, allUploadedImages.length - 1));
                        else setUploadedImageIndex(prev => Math.max(prev - 1, 0));
                      }
                      setTouchStartX(null);
                    }}
                  >
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={uploadedImageIndex}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.25 }}
                        src={allUploadedImages[uploadedImageIndex]}
                        alt={`Bild ${uploadedImageIndex + 1}`}
                        className="w-full rounded max-h-48 object-contain mx-auto"
                      />
                    </AnimatePresence>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/uploadimg:opacity-100 transition-opacity duration-200 flex items-center justify-center rounded-lg pointer-events-none">
                      <div className="flex items-center gap-2 text-white">
                        <ZoomIn className="h-6 w-6" />
                        <span className="text-sm font-medium">Klicken zum Vergrößern</span>
                      </div>
                    </div>
                    {/* Navigation arrows */}
                    {hasMultipleUploadedImages && (
                      <>
                        {uploadedImageIndex > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 bg-black/50 hover:bg-black/70 text-white rounded-full"
                            onClick={(e) => { e.stopPropagation(); setUploadedImageIndex(prev => prev - 1); }}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                        )}
                        {uploadedImageIndex < allUploadedImages.length - 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 bg-black/50 hover:bg-black/70 text-white rounded-full"
                            onClick={(e) => { e.stopPropagation(); setUploadedImageIndex(prev => prev + 1); }}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  {/* Dot indicators */}
                  {hasMultipleUploadedImages && (
                    <div className="flex justify-center gap-1.5 mt-2">
                      {allUploadedImages.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setUploadedImageIndex(idx)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            idx === uploadedImageIndex
                              ? "bg-pink-400 scale-125"
                              : "bg-slate-600 hover:bg-slate-400"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    {hasMultipleUploadedImages ? "Wische oder tippe für weitere Bilder" : "Tippe auf das Bild für Vollansicht"}
                  </p>
                </div>
              )}

              {/* Uploaded PDFs - Download list */}
              {allUploadedPdfs.length > 0 && (
                <div className="sm:col-span-2 bg-gradient-to-br from-red-500/10 via-orange-500/10 to-amber-500/10 rounded-xl p-4 border border-red-500/30">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-md bg-gradient-to-br from-red-500/30 to-orange-500/30 border border-red-500/40">
                      <FileText className="h-4 w-4 text-red-400" />
                    </div>
                    <span className="text-sm font-semibold text-slate-200">
                      {allUploadedPdfs.length > 1 ? `PDF-Dokumente (${allUploadedPdfs.length})` : "PDF-Dokument"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {allUploadedPdfs.map((pdf, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 bg-slate-900/80 rounded-lg p-3 border border-red-500/20"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-6 w-6 text-red-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{pdf.name}</p>
                            <p className="text-[10px] text-slate-500">PDF · Vom Admin bereitgestellt</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-shrink-0 bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30"
                          onClick={() => handleDownloadPdf(pdf.url, pdf.name)}
                        >
                          <Download className="h-3.5 w-3.5 mr-1.5" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}



              {/* Ident Link */}
              {data.ident_link && (
                <div className="sm:col-span-2 bg-slate-800/50 rounded-xl p-3 border border-slate-700/50" data-tour-id="identLink">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-cyan-500/20 border border-cyan-500/30">
                        <Link2 className="h-3.5 w-3.5 text-cyan-400" />
                      </div>
                      <span className="text-xs font-semibold text-slate-200">Ident-Link</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(data.ident_link!, "_blank")}
                        className="h-7 w-7 p-0 hover:bg-slate-700"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                      </Button>
                      <CopyButton
                        onClick={() => copyToClipboard(data.ident_link!, "ident_link", "Ident-Link")}
                        isCopied={copiedField === "ident_link"}
                      />
                    </div>
                  </div>
                  <div className="bg-slate-900/80 rounded-lg px-3 py-2 border border-cyan-500/30 font-mono text-xs text-cyan-300 break-all">
                    {data.ident_link}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" />
              <p className="text-sm">Warte auf Daten...</p>
            </div>
          )}
        </div>
        </motion.div>

        {/* Footer with Barcode - using brand accent (only show when content is visible) */}
        {showContent && (
          <div
            className="relative px-4 py-2 border-t flex-shrink-0"
            style={{ 
              borderColor: "hsl(var(--brand-accent-visible) / 0.2)",
              background: "hsl(var(--console-bg-dynamic))"
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[1px] h-5">
                {barcodePattern.map((width, i) => (
                  <div
                    key={i}
                    style={{
                      width: `${width}px`,
                      opacity: 0.2 + ((i * 17) % 10) / 25,
                      backgroundColor: "hsl(var(--brand-accent-visible))",
                    }}
                    className="h-full rounded-[0.5px]"
                  />
                ))}
              </div>
              <div className="text-right">
                <p className="text-[8px] text-slate-500 uppercase tracking-wider">REF</p>
                <p className="text-[10px] font-mono text-slate-400">
                  {taskId ? taskId.slice(0, 8).toUpperCase() : "--------"}
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Image Zoom Modal */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="max-w-3xl p-0 bg-black/95 border-0 overflow-hidden">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setImageModalOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            {modalImageUrl && (
              <img
                src={modalImageUrl}
                alt="Vergrößertes Bild"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            )}
            {/* Image navigation if multiple images */}
            {hasMultipleImages && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setModalImageUrl(img);
                      setCurrentImageIndex(idx);
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      modalImageUrl === img 
                        ? "bg-white scale-125" 
                        : "bg-white/40 hover:bg-white/70"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Helper Components
interface CopyButtonProps {
  onClick: () => void;
  isCopied: boolean;
}

const CopyButton = ({ onClick, isCopied }: CopyButtonProps) => (
  <Button
    size="sm"
    variant="ghost"
    onClick={onClick}
    className="h-7 w-7 p-0 hover:bg-slate-700"
  >
    {isCopied ? (
      <Check className="h-3.5 w-3.5 text-emerald-400" />
    ) : (
      <Copy className="h-3.5 w-3.5 text-slate-400" />
    )}
  </Button>
);

interface CompactCredentialRowProps {
  icon: ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  onCopy: () => void;
  isCopied: boolean;
  highlight?: boolean;
}

const CompactCredentialRow = ({ icon, iconColor, iconBg, label, value, onCopy, isCopied, highlight }: CompactCredentialRowProps) => (
  <div 
    className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
      highlight 
        ? "bg-gradient-to-r from-slate-700/60 to-slate-800/60 border border-slate-600/50" 
        : "bg-slate-800/40 hover:bg-slate-800/60"
    }`}
    onClick={onCopy}
  >
    <div className={`p-1 rounded-md border flex-shrink-0 ${iconBg}`}>
      <span className={iconColor}>{icon}</span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`font-mono text-xs truncate ${highlight ? "text-white font-semibold" : "text-slate-200"}`}>
        {value}
      </p>
    </div>
    <div className="flex-shrink-0">
      {isCopied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  </div>
);

export default DemoDataBadge;
