import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TourStep {
  id: string;
  tourTargetId: string;
  title: string;
  description: string;
}

interface DemoConsoleTourProps {
  visibleFields: {
    email?: boolean;
    password?: boolean;
    identCode?: boolean;
    identLink?: boolean;
    phone?: boolean;
    smsCode?: boolean;
    emailCode?: boolean;
    info?: boolean;
    images?: boolean;
    appStore?: boolean;
    username?: boolean;
    passcode?: boolean;
  };
  phase: "request" | "waiting" | "active" | "completed";
}

const FIELD_STEPS: Record<string, TourStep> = {
  appStore: {
    id: "field_appStore",
    tourTargetId: "appStore",
    title: "📲 App herunterladen",
    description: "Falls der Auftrag eine App erfordert, lade sie über die Store-Links herunter.",
  },
  email: {
    id: "field_email",
    tourTargetId: "email",
    title: "📧 E-Mail-Adresse",
    description: "Diese E-Mail wurde dir zugewiesen. Bestätigungs-Codes erscheinen automatisch in der Konsole.",
  },
  username: {
    id: "field_username",
    tourTargetId: "username",
    title: "👤 Benutzername",
    description: "Verwende diesen Benutzernamen bei der Anmeldung oder Registrierung.",
  },
  password: {
    id: "field_password",
    tourTargetId: "password",
    title: "🔑 Passwort",
    description: "Das vorgegebene Passwort für die Demo-Anmeldung. Kopiere es per Klick.",
  },
  passcode: {
    id: "field_passcode",
    tourTargetId: "passcode",
    title: "🔐 Passcode / PIN",
    description: "Ein zusätzlicher Sicherheitscode, der bei bestimmten Verifizierungsschritten benötigt wird.",
  },
  phone: {
    id: "field_phone",
    tourTargetId: "phone",
    title: "📱 Rufnummer",
    description: "Diese Nummer ist dir für SMS-Bestätigungen zugewiesen. Eingehende Codes erscheinen automatisch hier.",
  },
  identCode: {
    id: "field_identCode",
    tourTargetId: "identCode",
    title: "🆔 Ident-Code",
    description: "Gib diesen Code in der App des Anbieters ein, um den Identifizierungsprozess zu starten.",
  },
  identLink: {
    id: "field_identLink",
    tourTargetId: "identLink",
    title: "🔗 Ident-Link",
    description: "Über diesen Link startest du die Identifizierung direkt im Browser.",
  },
};

const FIELD_ORDER = [
  "appStore", "email", "username", "password", "passcode", "phone", "identCode", "identLink",
];

const AUTO_ADVANCE_MS = 5000;

export const DemoConsoleTour = ({ visibleFields, phase }: DemoConsoleTourProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStartRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    email,
    password,
    identCode,
    identLink,
    phone,
    info,
    appStore,
    username,
    passcode,
  } = visibleFields;

  const steps = useMemo(() => {
    if (phase !== "active") return [] as TourStep[];

    return FIELD_ORDER
      .filter((field) => visibleFields[field as keyof typeof visibleFields] && FIELD_STEPS[field])
      .map((field) => FIELD_STEPS[field]);
  }, [phase, email, password, identCode, identLink, phone, info, appStore, username, passcode]);

  useEffect(() => {
    if (phase === "active") return;

    setIsOpen(false);
    setCurrentStep(0);
    setTargetRect(null);
    setHasAutoStarted(false);

    if (timerRef.current) clearTimeout(timerRef.current);
    if (autoStartRef.current) clearTimeout(autoStartRef.current);
  }, [phase]);

  // Auto-start only after the first visible sequence has fully rendered
  useEffect(() => {
    if (phase !== "active" || steps.length === 0 || hasAutoStarted || isOpen) return;

    const STORAGE_KEY = "demoConsoleTour_autoStartCount";
    const count = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
    if (count >= 3) return;

    let cancelled = false;

    const waitForTargets = () => {
      if (cancelled) return;

      const allTargetsReady = steps.every((step) =>
        document.querySelector(`[data-tour-id="${step.tourTargetId}"]`),
      );

      if (!allTargetsReady) {
        autoStartRef.current = setTimeout(waitForTargets, 250);
        return;
      }

      autoStartRef.current = setTimeout(() => {
        if (cancelled) return;
        setCurrentStep(0);
        setIsOpen(true);
        setHasAutoStarted(true);
        localStorage.setItem(STORAGE_KEY, String(count + 1));
      }, 5000);
    };

    waitForTargets();

    return () => {
      cancelled = true;
      if (autoStartRef.current) clearTimeout(autoStartRef.current);
    };
  }, [phase, steps, hasAutoStarted, isOpen]);

  // Measure target element position
  const measureTarget = useCallback((stepIndex: number) => {
    if (stepIndex >= steps.length) return;
    const step = steps[stepIndex];
    const el = document.querySelector(`[data-tour-id="${step.tourTargetId}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      // Scroll into view if needed
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setTargetRect(null);
    }
  }, [steps]);

  // Start / reset auto-advance timer
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCurrentStep((prev) => {
        const next = prev + 1;
        if (next >= steps.length) {
          setIsOpen(false);
          return 0;
        }
        return next;
      });
    }, AUTO_ADVANCE_MS);
  }, [steps.length]);

  // When step changes, measure and restart timer
  useEffect(() => {
    if (!isOpen) return;
    measureTarget(currentStep);
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentStep, isOpen, measureTarget, resetTimer]);

  // Re-measure on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    const handleUpdate = () => measureTarget(currentStep);
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [isOpen, currentStep, measureTarget]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsOpen(false);
      setCurrentStep(0);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setCurrentStep(0);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleStart = () => {
    if (steps.length === 0) return;
    setCurrentStep(0);
    setIsOpen(true);
  };

  // Compute popup position
  const getPopupStyle = (): React.CSSProperties => {
    if (!targetRect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

    const padding = 12;
    const popupHeight = 160;
    const popupWidth = 320;

    // Prefer below the target
    let top = targetRect.bottom + padding;
    let left = targetRect.left + targetRect.width / 2 - popupWidth / 2;

    // If not enough space below, go above
    if (top + popupHeight > window.innerHeight - 20) {
      top = targetRect.top - padding - popupHeight;
    }

    // Clamp horizontal
    left = Math.max(16, Math.min(left, window.innerWidth - popupWidth - 16));

    return { top, left, width: popupWidth, position: "fixed" as const };
  };

  if (phase !== "active" || steps.length === 0) {
    return (
      <Button variant="outline" size="sm" className="gap-2 opacity-50" disabled>
        <HelpCircle className="h-4 w-4" />
        Hilfe
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleStart} className="gap-2">
        <HelpCircle className="h-4 w-4" />
        Hilfe
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Semi-transparent backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[9998]"
              style={{ background: "rgba(0,0,0,0.45)" }}
              onClick={handleNext}
            />

            {/* Highlight cutout around target */}
            {targetRect && (
              <motion.div
                key={`highlight-${currentStep}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="fixed z-[9999] pointer-events-none"
                style={{
                  top: targetRect.top - 6,
                  left: targetRect.left - 6,
                  width: targetRect.width + 12,
                  height: targetRect.height + 12,
                  borderRadius: 12,
                  boxShadow: "0 0 0 4000px rgba(0,0,0,0.45), 0 0 20px 4px rgba(59,130,246,0.35)",
                  border: "2px solid rgba(59,130,246,0.6)",
                }}
              />
            )}

            {/* Tooltip popup */}
            <AnimatePresence mode="wait">
              <motion.div
                key={steps[currentStep]?.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="z-[10000] bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
                style={getPopupStyle()}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Progress bar at top */}
                <div className="h-1 bg-muted">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: AUTO_ADVANCE_MS / 1000, ease: "linear" }}
                    key={`progress-${currentStep}`}
                  />
                </div>

                <div className="p-4">
                  {/* Warning for first step */}
                  {currentStep === 0 && (
                    <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      <span className="text-[11px] font-medium text-destructive">Nur Demo-Daten verwenden!</span>
                    </div>
                  )}

                  <h4 className="text-sm font-semibold text-foreground mb-1">
                    {steps[currentStep]?.title}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    {steps[currentStep]?.description}
                  </p>

                  <div className="flex items-center justify-between">
                    {/* Dots */}
                    <div className="flex gap-1">
                      {steps.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentStep(idx)}
                          className={`h-1.5 rounded-full transition-all ${
                            idx === currentStep
                              ? "w-4 bg-primary"
                              : idx < currentStep
                              ? "w-1.5 bg-primary/40"
                              : "w-1.5 bg-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={handleClose}>
                        <X className="h-3 w-3 mr-1" />
                        Schließen
                      </Button>
                      <Button size="sm" className="h-7 text-xs px-3" onClick={handleNext}>
                        {currentStep === steps.length - 1 ? "Fertig" : "Weiter"}
                        {currentStep < steps.length - 1 && <ChevronRight className="h-3 w-3 ml-0.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
