import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Phone, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/lib/toast-stub";

type Props = {
  open: boolean;
  userId: string;
  onComplete: () => void;
};

type Step = "intro" | "email-spinning" | "email-done" | "phone-spinning" | "phone-done" | "complete";

export function ResourceAssignmentModal({ open, userId, onComplete }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("intro");
  const [assignedEmail, setAssignedEmail] = useState<string | null>(null);
  const [assignedPhone, setAssignedPhone] = useState<string | null>(null);
  const [nectLink, setNectLink] = useState<string | null>(null);
  
  const [resourceAssignmentApproved, setResourceAssignmentApproved] = useState(false);
  const [emailPool, setEmailPool] = useState<string[]>([]);
  const [phonePool, setPhonePool] = useState<string[]>([]);
  const [reelEmail, setReelEmail] = useState<string>("auswahl@outlook.de");
  const [reelPhone, setReelPhone] = useState<string>("+49 ••• •••••••");
  const [loading, setLoading] = useState(false);
  const reelTimerRef = useRef<number | null>(null);

  // Lade Status: Email, Telefonnummer und Admin-Freigabe (nur echte Daten,
  // keine Fallback-Pools — es darf nichts angezeigt werden, was nicht
  // tatsächlich zugewiesen wurde).
  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;

    const load = async () => {
      const [emailRes, phoneRes, profileRes] = await Promise.all([
        supabase.from("email_accounts").select("email_address").eq("assigned_to", userId).limit(1),
        supabase.from("phone_numbers").select("phone_number").eq("assigned_to", userId).limit(1),
        supabase.from("profiles").select("nect_link, resource_assignment_approved" as any).eq("id", userId).maybeSingle(),
      ]);
      if (cancelled) return;

      const myEmail = emailRes.data?.[0]?.email_address || null;
      const myPhone = phoneRes.data?.[0]?.phone_number || null;
      const myNect = (profileRes.data as any)?.nect_link || null;
      const myApproved = Boolean((profileRes.data as any)?.resource_assignment_approved);

      setAssignedEmail(myEmail);
      setAssignedPhone(myPhone);
      setNectLink(myNect);
      setResourceAssignmentApproved(myApproved);

      // Pool nur aus echten anderen Adressen (für Slot-Machine-Effekt während der Animation).
      // KEIN Fake-Fallback mehr.
      const { data: poolEmails } = await supabase
        .from("email_accounts")
        .select("email_address")
        .limit(30);
      if (cancelled) return;
      setEmailPool(
        (poolEmails || [])
          .map((e) => e.email_address)
          .filter((addr): addr is string => Boolean(addr) && addr !== myEmail)
      );

      const { data: poolPhones } = await supabase
        .from("phone_numbers")
        .select("phone_number")
        .limit(30);
      if (cancelled) return;
      setPhonePool(
        (poolPhones || [])
          .map((p) => p.phone_number)
          .filter((num): num is string => Boolean(num) && num !== myPhone)
      );
    };

    load();

    // Polling alle 5 s, damit Mitarbeiter automatisch sehen, sobald der Admin
    // Email/Telefonnummer zuweist und die Freigabe erteilt.
    const id = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, userId]);

  const startEmailReel = async () => {
    setLoading(true);

    // IMMER frisch aus DB laden, um stale State zu vermeiden
    const { data, error } = await supabase
      .from("email_accounts")
      .select("email_address")
      .eq("assigned_to", userId)
      .limit(1);

    console.log("[ResourceAssignmentModal] Assigned email lookup:", { data, error, userId });

    const finalEmail = data?.[0]?.email_address || null;

    if (!finalEmail) {
      toast({
        title: "Keine E-Mail verfügbar",
        description: "Bitte warten Sie auf die Freigabe durch die Personalabteilung.",
      });
      setLoading(false);
      return;
    }

    setAssignedEmail(finalEmail);
    setStep("email-spinning");

    // Slot-Machine-Pool: ausschließlich echte Adressen aus dem System.
    const reelPool = emailPool.filter((addr) => addr !== finalEmail);

    let ticks = 0;
    const totalTicks = 28; // ~2.8s
    reelTimerRef.current = window.setInterval(() => {
      ticks++;
      if (ticks >= totalTicks) {
        if (reelTimerRef.current) window.clearInterval(reelTimerRef.current);
        // Garantiert die echte zugewiesene Adresse als Endwert
        setReelEmail(finalEmail);
        setStep("email-done");
        setLoading(false);
      } else {
        const idx = Math.floor(Math.random() * reelPool.length);
        setReelEmail(reelPool[idx] || finalEmail);
      }
    }, 100);
  };

  const startPhoneReel = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("phone_numbers")
      .select("phone_number")
      .eq("assigned_to", userId)
      .limit(1);

    console.log("[ResourceAssignmentModal] Assigned phone lookup:", { data, error, userId });

    // NECT-Link + Freigabe erneut frisch vom Profil laden
    const { data: profileData } = await supabase
      .from("profiles")
      .select("nect_link, resource_assignment_approved" as any)
      .eq("id", userId)
      .maybeSingle();
    const finalNect = (profileData as any)?.nect_link || nectLink || null;
    const finalApproved = Boolean((profileData as any)?.resource_assignment_approved);
    if (finalNect) setNectLink(finalNect);
    setResourceAssignmentApproved(finalApproved);

    // Echte Rufnummer ODER NECT-Link akzeptieren (NECT stellt die Nummer
    // dynamisch bereit — Platzhalter im UI ist OK).
    const finalPhone =
      data?.[0]?.phone_number ||
      (finalNect ? "Wird via NECT bereitgestellt" : null);

    if (!finalPhone) {
      toast({
        title: "Keine Rufnummer verfügbar",
        description: "Bitte warten Sie auf die Freigabe durch die Personalabteilung.",
      });
      setLoading(false);
      return;
    }

    setAssignedPhone(finalPhone);
    setStep("phone-spinning");

    const reelPool = phonePool.filter((n) => n !== finalPhone);

    let ticks = 0;
    const totalTicks = 28;
    reelTimerRef.current = window.setInterval(() => {
      ticks++;
      if (ticks >= totalTicks) {
        if (reelTimerRef.current) window.clearInterval(reelTimerRef.current);
        setReelPhone(finalPhone);
        setStep("phone-done");
        setLoading(false);
      } else {
        const idx = Math.floor(Math.random() * reelPool.length);
        setReelPhone(reelPool[idx] || finalPhone);
      }
    }, 100);
  };

  useEffect(() => {
    return () => {
      if (reelTimerRef.current) window.clearInterval(reelTimerRef.current);
    };
  }, []);

  // Sobald die Admin-Freigabe erteilt wurde und alle Schritte abgeschlossen sind,
  // Popup automatisch schließen.
  useEffect(() => {
    if (resourceAssignmentApproved && step === "phone-done") {
      try {
        localStorage.setItem(`resource_assignment_seen_${userId}`, "1");
      } catch {
        /* ignore */
      }
      onComplete();
    }
  }, [resourceAssignmentApproved, step, userId, onComplete]);

  // Freigabe-Status: nur echtes Admin-Flag darf das Popup schließen.
  const adminApproved = resourceAssignmentApproved;

  const finish = () => {
    if (!adminApproved) return;
    try {
      localStorage.setItem(`resource_assignment_seen_${userId}`, "1");
    } catch {
      /* ignore */
    }
    onComplete();
  };

  if (!open) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border bg-background p-6 shadow-2xl pointer-events-auto">
        <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold leading-none tracking-tight">
            <Sparkles className="h-5 w-5 text-primary" />
            Letzte Vorbereitung
          </h2>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed space-y-2">
            <p className="font-medium">
              Eine letzte Sache, dann können Sie mit den Aufträgen starten:
            </p>
            <p className="text-muted-foreground">
              Zusätzlich erhalten Sie eine temporäre E-Mail-Adresse und Rufnummer,
              die ausschließlich für auftragsbezogene Tätigkeiten verwendet werden.
            </p>
            <p className="text-muted-foreground">
              Diese Kontaktdaten dienen dazu, dass Sie später in Ihrer Auftragskonsole
              sämtliche Informationen, Updates und Bestätigungen zu Ihren Aufträgen
              zuverlässig erhalten.
            </p>
          </div>

          {/* EMAIL CARD */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">1. E-Mail-Adresse</span>
              {step !== "intro" && step !== "email-spinning" && (
                <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />
              )}
            </div>

            <div className="relative h-14 rounded-md bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 overflow-hidden flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={reelEmail}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -30, opacity: 0 }}
                  transition={{ duration: 0.08 }}
                  className="font-mono text-sm md:text-base font-semibold text-foreground"
                >
                  {reelEmail}
                </motion.div>
              </AnimatePresence>
              {step === "email-spinning" && (
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background/40 via-transparent to-background/40" />
              )}
            </div>

            {step === "intro" && (
              <Button
                onClick={startEmailReel}
                className="w-full mt-3"
                disabled={loading || !assignedEmail}
              >
                {assignedEmail ? "E-Mail generieren" : "Warten auf Zuweisung durch Personalabteilung…"}
              </Button>
            )}
            {step === "email-spinning" && (
              <Button className="w-full mt-3" disabled>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adresse wird zugewiesen…
              </Button>
            )}
            {(step === "email-done" ||
              step === "phone-spinning" ||
              step === "phone-done" ||
              step === "complete") && (
              <p className="text-xs text-green-700 dark:text-green-400 mt-2 text-center">
                ✓ Adresse erfolgreich zugewiesen
              </p>
            )}
          </div>

          {/* PHONE CARD */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">2. Rufnummer</span>
              {(step === "phone-done" || step === "complete") && (
                <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />
              )}
            </div>

            <div className="relative h-14 rounded-md bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 overflow-hidden flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={reelPhone}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -30, opacity: 0 }}
                  transition={{ duration: 0.08 }}
                  className="font-mono text-sm md:text-base font-semibold text-foreground"
                >
                  {reelPhone}
                </motion.div>
              </AnimatePresence>
              {step === "phone-spinning" && (
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background/40 via-transparent to-background/40" />
              )}
            </div>

            {step === "email-done" && (
              <Button
                onClick={startPhoneReel}
                className="w-full mt-3"
                disabled={loading || (!assignedPhone && !nectLink)}
              >
                {assignedPhone || nectLink ? "Rufnummer anfordern" : "Warten auf Zuweisung durch Personalabteilung…"}
              </Button>
            )}
            {step === "phone-spinning" && (
              <Button className="w-full mt-3" disabled>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Rufnummer wird zugewiesen…
              </Button>
            )}
            {(step === "phone-done" || step === "complete") && (
              <>
                <p className="text-xs text-green-700 dark:text-green-400 mt-2 text-center">
                  ✓ Rufnummer erfolgreich zugewiesen
                </p>
                <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground space-y-2">
                  <p>
                    <span className="font-medium text-foreground">Ihre neue Rufnummer:</span> Hierbei
                    handelt es sich um einen neuen Prozess über die{" "}
                    <span className="font-medium text-foreground">NECT-Legitimation</span>. Dabei wird eine
                    von <span className="font-medium text-foreground">EuroScent</span> gesponserte Rufnummer
                    unseres Partners <span className="font-medium text-foreground">EDEKA</span> für
                    Arbeitszwecke bereitgestellt.
                  </p>
                  {nectLink && (
                    <a
                      href={nectLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      🔗 NECT-Legitimation starten
                    </a>
                  )}
                </div>
              </>
            )}
            {step === "intro" || step === "email-spinning" ? (
              <Button className="w-full mt-3" disabled variant="outline">
                Rufnummer anfordern
              </Button>
            ) : null}
          </div>

          {step === "phone-done" && adminApproved && (
            <Button
              onClick={finish}
              className="w-full"
              size="lg"
            >
              Jetzt mit den Aufträgen starten
            </Button>
          )}
        </div>
    </div>
  );
}
