import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/toast-stub";
import { ArrowLeft, CheckCircle2, AlertCircle, Camera, RotateCcw, Search, Lock, Briefcase, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ScanStep = "scan-front" | "flip-document" | "scan-back" | "choose-method" | "complete";
type DocType = "id";
type VerificationMethod = "pending" | null;

interface StarterTask {
  id: string;
  title: string;
  description: string | null;
  client?: { name: string; logo_url: string | null } | null;
}

// Component for showing starter jobs preview (greyed out)
const StarterJobsPreview = ({ 
  searchingJobs, 
  starterTasks, 
  onSearchComplete,
  showLockMessage = false
}: { 
  searchingJobs: boolean; 
  starterTasks: StarterTask[];
  onSearchComplete?: () => void;
  showLockMessage?: boolean;
}) => {
  useEffect(() => {
    if (!searchingJobs && onSearchComplete) {
      onSearchComplete();
    }
  }, [searchingJobs, onSearchComplete]);

  return (
    <div className="space-y-4">
      {/* Search Animation */}
      {searchingJobs && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center py-6"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary mb-4"
          />
          <div className="flex items-center gap-2 text-muted-foreground">
            <Search className="h-4 w-4" />
            <span>Suche nach passenden Aufträgen...</span>
          </div>
        </motion.div>
      )}

      {/* Starter Jobs Preview */}
      {!searchingJobs && starterTasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {showLockMessage && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg mb-2">
              <Lock className="h-4 w-4" />
              <span>Aufträge werden freigeschaltet nach Admin-Verifizierung</span>
            </div>
          )}
          
          <p className="text-sm text-muted-foreground">
            {starterTasks.length} Starter-Aufträge gefunden:
          </p>
          
          {starterTasks.map((task, index) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="opacity-50 grayscale pointer-events-none select-none border-dashed">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    {task.client?.logo_url ? (
                      <img src={task.client.logo_url} alt="" className="h-6 w-6 object-contain" />
                    ) : (
                      <Briefcase className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm truncate">{task.title}</h4>
                      <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    </div>
                    {task.client?.name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {task.client.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Bald verfügbar</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* No jobs found */}
      {!searchingJobs && starterTasks.length === 0 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          Nach Ihrer Verifizierung werden Ihnen passende Aufträge zugewiesen.
        </div>
      )}
    </div>
  );
};

const Verification = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  
  // Scanner state
  const [scanStep, setScanStep] = useState<ScanStep>("scan-front");
  const [selectedDocType, setSelectedDocType] = useState<DocType>("id");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const submitInProgressRef = useRef(false);
  
  // Starter jobs preview
  const [starterTasks, setStarterTasks] = useState<StarterTask[]>([]);
  const [searchingJobs, setSearchingJobs] = useState(false);

  // Quality & stability detection
  const [isStable, setIsStable] = useState(false);
  const [documentDetected, setDocumentDetected] = useState(false);
  const [qualityStatus, setQualityStatus] = useState<"waiting" | "dark" | "moving" | "no-document" | "ready">("waiting");

  // Debug overlay state
  const [showDebug, setShowDebug] = useState(false);
  const [debugMetrics, setDebugMetrics] = useState<{
    avgEdge: number;
    contrast: number;
    avgBrightness: number;
    lightRatio: number;
    darkRatio: number;
    coloredRatio: number;
    stabilityCounter: number;
    documentCounter: number;
    motionDiff: number;
  }>({
    avgEdge: 0,
    contrast: 0,
    avgBrightness: 0,
    lightRatio: 0,
    darkRatio: 0,
    coloredRatio: 0,
    stabilityCounter: 0,
    documentCounter: 0,
    motionDiff: 0,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const stabilityCounterRef = useRef(0);
  const documentCounterRef = useRef(0);
  const qualityRafRef = useRef<number | null>(null);
  const autoScanTriggeredRef = useRef(false);
  const aiCheckInProgressRef = useRef(false);
  const aiCheckCounterRef = useRef(0);
  type ExtractedIdData = {
    surname: string | null;
    givenNames: string | null;
    dateOfBirth: string | null;
    nationality: string | null;
    placeOfBirth: string | null;
    expiryDate: string | null;
  };

  const [aiDetectionStatus, setAiDetectionStatus] = useState<"idle" | "checking" | "confirmed" | "failed">("idle");
  const [aiDetectionMeta, setAiDetectionMeta] = useState<{ confidence?: string; reason?: string } | null>(null);
  const [extractedIdData, setExtractedIdData] = useState<ExtractedIdData | null>(null);
  const aiDetectionStatusRef = useRef<typeof aiDetectionStatus>("idle");

  useEffect(() => {
    aiDetectionStatusRef.current = aiDetectionStatus;
  }, [aiDetectionStatus]);

  const navigate = useNavigate();
  const { toast } = useToast();
  useEffect(() => {
    checkAuth();
    return () => {
      // Cleanup camera on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);

    // Admins überspringen Verifizierung
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
    const isAdmin = roles?.some((r: any) => r.role === "admin");
    if (isAdmin) {
      navigate("/dashboard");
      return;
    }

    // Check if already verified or verification pending
    const { data: profile } = await supabase
      .from("profiles")
      .select("verified, verification_requested_at")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profile?.verified) {
      setIsVerified(true);
    } else if (profile?.verification_requested_at) {
      setVerificationPending(true);
    }

    setLoading(false);
  };

  // Fetch starter jobs when entering choose-method step
  const fetchStarterJobs = useCallback(async () => {
    setSearchingJobs(true);
    
    // Simulate search animation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { data: tasks } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        description,
        client:clients(name, logo_url)
      `)
      .eq("is_starter_job", true)
      .limit(3);
    
    setStarterTasks(tasks as StarterTask[] || []);
    setSearchingJobs(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      // If a previous stream exists, fully stop + detach it first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        (videoRef.current as any).srcObject = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        (video as any).srcObject = stream;

        // Wait until the video has metadata, otherwise some mobile browsers show a black frame
        await new Promise<void>((resolve) => {
          const handler = () => {
            video.removeEventListener("loadedmetadata", handler);
            resolve();
          };
          video.addEventListener("loadedmetadata", handler);
        });
        try {
          await video.play();
        } catch (err) {
          // Some mobile browsers require an explicit user gesture to start playback
          console.warn("Video play blocked (needs user gesture)", err);
          setCameraActive(false);
          toast({
            title: "Kamera bereit",
            description: "Tippen Sie auf 'Kamera starten', um die Kamera zu aktivieren.",
          });
          return;
        }
      }

      setCameraActive(true);
    } catch (error) {
      console.error("Camera error:", error);
      setCameraActive(false);
      toast({
        title: "Kamera-Fehler",
        description: "Kamera konnte nicht gestartet werden. Bitte erlauben Sie den Kamera-Zugriff.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    if (qualityRafRef.current) {
      cancelAnimationFrame(qualityRafRef.current);
      qualityRafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      (videoRef.current as any).srcObject = null;
    }
    prevFrameRef.current = null;
    stabilityCounterRef.current = 0;
    documentCounterRef.current = 0;
    autoScanTriggeredRef.current = false;
    aiCheckInProgressRef.current = false;
    aiCheckCounterRef.current = 0;
    setAiDetectionStatus("idle");
    setAiDetectionMeta(null);
    setExtractedIdData(null);
    setIsStable(false);
    setDocumentDetected(false);
    setQualityStatus("waiting");
    setCameraActive(false);
  }, []);

  // Detect if a German ID card (Personalausweis) or residence permit (Aufenthaltstitel) is in frame.
  // Returns both the detection result and the metrics for debugging.
  type DocSide = "front" | "back";
  type DetectionResult = {
    detected: boolean;
    avgEdge: number;
    contrast: number;
    avgBrightness: number;
    lightRatio: number;
    darkRatio: number;
    coloredRatio: number;
  };

  const detectGermanDocument = useCallback(
    (canvas: HTMLCanvasElement, side: DocSide): DetectionResult => {
      const defaultResult: DetectionResult = {
        detected: false,
        avgEdge: 0,
        contrast: 0,
        avgBrightness: 0,
        lightRatio: 0,
        darkRatio: 0,
        coloredRatio: 0,
      };

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return defaultResult;

      const w = canvas.width;
      const h = canvas.height;
      if (w < 40 || h < 40) return defaultResult;

      const imgData = ctx.getImageData(0, 0, w, h);
      const { data } = imgData;

      // --- 1) Detail / edge energy (detect that there's actual content, not blank wall) ---
      let edgeSum = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          const idxRight = (y * w + x + 1) * 4;
          const idxDown = ((y + 1) * w + x) * 4;

          const gx =
            Math.abs(data[idx] - data[idxRight]) +
            Math.abs(data[idx + 1] - data[idxRight + 1]) +
            Math.abs(data[idx + 2] - data[idxRight + 2]);
          const gy =
            Math.abs(data[idx] - data[idxDown]) +
            Math.abs(data[idx + 1] - data[idxDown + 1]) +
            Math.abs(data[idx + 2] - data[idxDown + 2]);

          edgeSum += gx + gy;
        }
      }
      const avgEdge = edgeSum / ((w - 2) * (h - 2));

      // --- 2) Brightness and contrast + rough color stats ---
      let minBrightness = 255;
      let maxBrightness = 0;
      let brightnessSum = 0;
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let saturatedPixels = 0;
      const totalPixels = data.length / 4;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        brightnessSum += brightness;
        minBrightness = Math.min(minBrightness, brightness);
        maxBrightness = Math.max(maxBrightness, brightness);

        rSum += r;
        gSum += g;
        bSum += b;

        // simple saturation proxy
        const cMax = Math.max(r, g, b);
        const cMin = Math.min(r, g, b);
        if (cMax - cMin > 45) saturatedPixels++;
      }

      const avgBrightness = brightnessSum / totalPixels;
      const contrast = maxBrightness - minBrightness;
      const avgR = rSum / totalPixels;
      const avgG = gSum / totalPixels;
      const avgB = bSum / totalPixels;
      const saturationRatio = saturatedPixels / totalPixels;

      // --- 3) Check for card-like characteristics ---
      let lightPixels = 0;
      let darkPixels = 0;

      for (let i = 0; i < data.length; i += 4) {
        const brightness = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        if (brightness > 150) lightPixels++;
        if (brightness < 80) darkPixels++;
      }

      const lightRatio = lightPixels / totalPixels;
      const darkRatio = darkPixels / totalPixels;

      // For front side, check for colored accents (the red/orange stripe at top)
      let coloredRatio = 0;
      if (side === "front") {
        let coloredPixels = 0;
        const topYMax = Math.floor(h * 0.35);

        for (let y = 0; y < topYMax; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // More specific detection to reduce false positives:
            // German ID header has a warm salmon/orange band; residence permits often have blue tones.
            const isReddish =
              r > 140 &&
              r - g > 25 &&
              r - b > 35 &&
              g > 60 &&
              g < 190 &&
              b < 170;

            const isBluish =
              b > 130 &&
              b - r > 25 &&
              b - g > 20 &&
              r < 150;

            if (isReddish || isBluish) coloredPixels++;
          }
        }

        coloredRatio = topYMax > 0 ? coloredPixels / (topYMax * w) : 0;
      }

      // Build result with all metrics
      const result: DetectionResult = {
        detected: false,
        avgEdge,
        contrast,
        avgBrightness,
        lightRatio,
        darkRatio,
        coloredRatio,
      };

      // Tuned thresholds: stricter to avoid false positives from everyday objects.
      // We aim specifically for the German ID card look (light / beige-ish card with printed content).

      // 0) Basic scene sanity
      // Enough fine detail (text/photo edges). Objects with flat surfaces should fail.
      if (avgEdge < 30) return result;

      // Some dynamic range (avoid uniform walls / fabric)
      if (contrast < 110) return result;

      // Reject very dark frames
      if (avgBrightness < 80) return result;

      // German ID is typically a fairly neutral/beige card. This helps reject colorful everyday scenes.
      if (saturationRatio > 0.38) return result;
      const warmRG = avgR - avgG;
      const warmRB = avgR - avgB;
      const warmGB = avgG - avgB;
      // Require a mild warm/neutral tone (beige-ish), not strongly blue/green.
      if (warmRB < 6 || warmRB > 75) return result;
      if (warmGB < -8 || warmGB > 60) return result;
      // Avoid strong red casts (e.g., fabrics/objects)
      if (warmRG > 55) return result;

      // ID cards are predominantly light but not almost fully white
      if (lightRatio < 0.38 || lightRatio > 0.92) return result;

      // Must contain a meaningful amount of dark pixels (text/photo), but not dominate
      if (darkRatio < 0.06 || darkRatio > 0.40) return result;

      // 1) Side-specific checks
      if (side === "front") {
        // Front side often has a small colored header band, but it can be missed.
        // Require either a tiny color hint OR very strong structure.
        const minHintColor = 0.004; // 0.4%
        const hasStrongStructure = avgEdge >= 40 && contrast >= 135;
        if (coloredRatio < minHintColor && !hasStrongStructure) return result;

        // Guard against highly colorful scenes.
        if (coloredRatio > 0.18) return result;
      }

      if (side === "back") {
        // Back side has the MRZ area (dense dark text) near the bottom.
        // Check bottom band for enough dark pixels.
        const bottomStartY = Math.floor(h * 0.70);
        let bottomDark = 0;
        let bottomTotal = 0;
        for (let y = bottomStartY; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const brightness = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
            if (brightness < 95) bottomDark++;
            bottomTotal++;
          }
        }
        const bottomDarkRatio = bottomTotal ? bottomDark / bottomTotal : 0;
        if (bottomDarkRatio < 0.09 || bottomDarkRatio > 0.55) return result;

        // Slightly higher brightness requirement for back (helps avoid random dark scenes)
        if (avgBrightness < 90) return result;
      }

      result.detected = true;
      return result;
    },
    []
  );

  const triggerAiDetection = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) return;
    if (aiCheckInProgressRef.current) return;

    aiCheckInProgressRef.current = true;
    setAiDetectionStatus("checking");
    setAiDetectionMeta(null);

    try {
      const aiCanvas = document.createElement("canvas");
      aiCanvas.width = 640;
      aiCanvas.height = 480;
      const aiCtx = aiCanvas.getContext("2d");
      if (!aiCtx) throw new Error("Canvas context unavailable");

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      // Crop to the upper part a bit more because your example text is at the very top.
      const sx = Math.floor(vw * 0.06);
      const sy = Math.floor(vh * 0.08);
      const sw = Math.floor(vw * 0.88);
      const sh = Math.floor(vh * 0.78);
      aiCtx.drawImage(video, sx, sy, sw, sh, 0, 0, 640, 480);

      const imageBase64 = aiCanvas.toDataURL("image/jpeg", 0.85);
      const side = scanStep === "scan-back" ? "back" : "front";

      console.log("[KYC] triggerAiDetection", { side });

      const { data, error } = await supabase.functions.invoke("detect-german-id", {
        body: { imageBase64, side },
      });

      if (error) throw error;

      console.log("[KYC] AI detection result", data);
      setAiDetectionMeta({ confidence: data?.confidence, reason: data?.reason });

      if (side === "front") {
        setExtractedIdData({
          surname: data?.surname ?? null,
          givenNames: data?.givenNames ?? null,
          dateOfBirth: data?.dateOfBirth ?? null,
          nationality: data?.nationality ?? null,
          placeOfBirth: data?.placeOfBirth ?? null,
          expiryDate: data?.expiryDate ?? null,
        });
      }

      if (data?.detected) {
        setAiDetectionStatus("confirmed");
        documentCounterRef.current = 20;
      } else {
        setAiDetectionStatus("idle");
      }
    } catch (e) {
      console.error("[KYC] AI detection failed", e);
      setAiDetectionStatus("failed");
      const msg = e instanceof Error ? e.message : "AI detection failed";
      setAiDetectionMeta({ reason: msg });
      toast({
        title: "KI-Erkennung fehlgeschlagen",
        description: "Bitte kurz warten und erneut versuchen.",
        variant: "destructive",
      });
    } finally {
      aiCheckInProgressRef.current = false;
    }
  }, [scanStep, toast]);

  // Continuous quality & stability check loop
  const runQualityCheck = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !video.videoWidth) {
      qualityRafRef.current = requestAnimationFrame(runQualityCheck);
      return;
    }

    // Use a slightly higher sampling resolution + crop to the center area (where the UI frame is).
    // This makes detection much more reliable on mobile where the ID may occupy only a part of the camera feed.
    const sampleW = 240;
    const sampleH = 180;
    canvas.width = sampleW;
    canvas.height = sampleH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      qualityRafRef.current = requestAnimationFrame(runQualityCheck);
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const sx = Math.floor(vw * 0.15);
    const sy = Math.floor(vh * 0.22);
    const sw = Math.floor(vw * 0.70);
    const sh = Math.floor(vh * 0.56);

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sampleW, sampleH);
    const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
    const { data } = imgData;

    // 1. Brightness check
    let brightnessSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      brightnessSum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }
    const avgBrightness = brightnessSum / (data.length / 4);
    if (avgBrightness < 30) {
      setQualityStatus("dark");
      setIsStable(false);
      setDocumentDetected(false);
      stabilityCounterRef.current = 0;
      documentCounterRef.current = 0;
      prevFrameRef.current = imgData;
      qualityRafRef.current = requestAnimationFrame(runQualityCheck);
      return;
    }

    // 2. Motion/stability check (compare with previous frame)
    const prevFrame = prevFrameRef.current;
    let isCurrentlyStable = false;
    let motionDiff = 0;
    
    if (prevFrame) {
      let diff = 0;
      for (let i = 0; i < data.length; i += 4) {
        diff += Math.abs(data[i] - prevFrame.data[i]);
        diff += Math.abs(data[i + 1] - prevFrame.data[i + 1]);
        diff += Math.abs(data[i + 2] - prevFrame.data[i + 2]);
      }
      motionDiff = diff / (data.length / 4 * 3);

      if (motionDiff > 8) {
        // Too much motion
        stabilityCounterRef.current = 0;
        documentCounterRef.current = 0;
        setDocumentDetected(false);
      } else {
        // Frame is stable
        stabilityCounterRef.current += 1;
        if (stabilityCounterRef.current >= 12) {
          isCurrentlyStable = true;
        }
      }
    }

    // 3. Document detection
    let detectionResult = {
      avgEdge: 0,
      contrast: 0,
      avgBrightness: 0,
      lightRatio: 0,
      darkRatio: 0,
      coloredRatio: 0,
    };

    // Basic pixel checks (fast heuristic). We use this for auto-detection,
    // and AI as an additional confirmation boost.
    if (stabilityCounterRef.current >= 4) {
      const side = scanStep === "scan-back" ? "back" : "front";
      const result = detectGermanDocument(canvas, side);
      detectionResult = result;

      // Keep a small streak counter so we don't get a single-frame false positive.
      // This also allows auto-scan even when AI is temporarily slow/unavailable.
      if (result.detected) {
        documentCounterRef.current = Math.min(20, documentCounterRef.current + 2);
      } else {
        documentCounterRef.current = Math.max(0, documentCounterRef.current - 1);
      }
    } else {
      // Not enough stability yet → decay the counter.
      documentCounterRef.current = Math.max(0, documentCounterRef.current - 1);
    }

    // Update debug metrics
    setDebugMetrics({
      ...detectionResult,
      stabilityCounter: stabilityCounterRef.current,
      documentCounter: documentCounterRef.current,
      motionDiff,
    });

    // Trigger AI-based detection regularly once there is some stability.
    // (Also works even if we haven't reached the full "stable" threshold yet.)
    if (
      !aiCheckInProgressRef.current &&
      aiDetectionStatusRef.current !== "confirmed" &&
      stabilityCounterRef.current >= 6 &&
      aiCheckCounterRef.current % 10 === 0
    ) {
      void triggerAiDetection();
    }
    aiCheckCounterRef.current += 1;

    const aiStatus = aiDetectionStatusRef.current;

    // Confirm if either:
    // - AI confirmed
    // - Heuristic streak is strong enough
    const documentConfirmed = aiStatus === "confirmed" || documentCounterRef.current >= 12;

    // Update states based on checks
    if (!isCurrentlyStable) {
      setQualityStatus("moving");
      setIsStable(false);
      setDocumentDetected(false);
      // Reset AI status when moving
      if (aiStatus === "confirmed") {
        setAiDetectionStatus("idle");
      }
    } else if (!documentConfirmed) {
      setQualityStatus(aiStatus === "checking" ? "waiting" : "no-document");
      setIsStable(true);
      setDocumentDetected(false);
    } else {
      setQualityStatus("ready");
      setIsStable(true);
      setDocumentDetected(true);
    }

    prevFrameRef.current = imgData;
    qualityRafRef.current = requestAnimationFrame(runQualityCheck);
  }, [detectGermanDocument, scanStep, triggerAiDetection]);

  // Start quality check loop when camera becomes active
  useEffect(() => {
    if (cameraActive && (scanStep === "scan-front" || scanStep === "scan-back")) {
      prevFrameRef.current = null;
      stabilityCounterRef.current = 0;
      documentCounterRef.current = 0;
      autoScanTriggeredRef.current = false;
      setQualityStatus("waiting");
      setIsStable(false);
      setDocumentDetected(false);
      qualityRafRef.current = requestAnimationFrame(runQualityCheck);
    }
    return () => {
      if (qualityRafRef.current) {
        cancelAnimationFrame(qualityRafRef.current);
        qualityRafRef.current = null;
      }
    };
  }, [cameraActive, scanStep, runQualityCheck]);

  // Auto-trigger scan when stable AND document detected
  useEffect(() => {
    if (
      cameraActive &&
      isStable &&
      documentDetected &&
      !isScanning &&
      !autoScanTriggeredRef.current &&
      (scanStep === "scan-front" || scanStep === "scan-back")
    ) {
      // Small delay to show "ready" state before scanning
      const timer = setTimeout(() => {
        // Important: set the flag ONLY when we actually trigger the scan.
        // Otherwise the flag could get stuck "true" when the state flips during the timeout.
        autoScanTriggeredRef.current = true;
        handleScan();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [cameraActive, isStable, documentDetected, isScanning, scanStep]);

  // Fetch starter jobs when entering choose-method step
  useEffect(() => {
    if (scanStep === "choose-method") {
      fetchStarterJobs();
    }
  }, [scanStep, fetchStarterJobs]);

  // Reset the auto-trigger flag whenever the user moves, loses detection, or the camera/step changes.
  // This prevents the scanner from getting stuck in a "ready but not scanning" state.
  useEffect(() => {
    if (!cameraActive || isScanning || qualityStatus !== "ready") {
      autoScanTriggeredRef.current = false;
    }
  }, [cameraActive, isScanning, qualityStatus, scanStep]);

  const captureImage = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // If the video element hasn't produced frames yet, capturing will result in a black/empty image.
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
      return null;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);

    // Detect "black" frames (common on mobile when stream/playback is flaky).
    // Sample a small grid for speed.
    try {
      const sampleW = 32;
      const sampleH = 24;
      const tmp = document.createElement("canvas");
      tmp.width = sampleW;
      tmp.height = sampleH;
      const tctx = tmp.getContext("2d", { willReadFrequently: true });
      if (tctx) {
        tctx.drawImage(canvas, 0, 0, sampleW, sampleH);
        const { data } = tctx.getImageData(0, 0, sampleW, sampleH);

        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          // perceived luminance
          sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        }
        const avg = sum / (data.length / 4);

        // Threshold chosen to avoid false positives while blocking completely dark captures.
        if (avg < 12) return null;
      }
    } catch {
      // If sampling fails, still proceed with capture.
    }

    return canvas.toDataURL("image/jpeg", 0.9);
  }, []);

  // Start camera automatically when component loads and not verified
  useEffect(() => {
    if (!loading && !isVerified && !verificationPending && (scanStep === "scan-front" || scanStep === "scan-back") && !cameraActive) {
      // Small delay for scan-back to ensure camera is properly released
      if (scanStep === "scan-back") {
        const timer = setTimeout(() => {
          startCamera();
        }, 500);
        return () => clearTimeout(timer);
      } else {
        startCamera();
      }
    }
  }, [loading, isVerified, verificationPending, scanStep, cameraActive, startCamera]);

  // Auto-transition to back scan after 3 seconds on flip-document step
  useEffect(() => {
    if (scanStep === "flip-document") {
      const timer = setTimeout(() => {
        // Reset all detection states
        autoScanTriggeredRef.current = false;
        stabilityCounterRef.current = 0;
        documentCounterRef.current = 0;
        setDocumentDetected(false);
        setIsStable(false);
        setQualityStatus("waiting");
        
        // Go to back scan step - camera will auto-start via the effect above
        setScanStep("scan-back");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [scanStep]);

  const validateGermanDocDataUrl = useCallback(
    (dataUrl: string, side: "front" | "back") => {
      return new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const tmp = document.createElement("canvas");
          tmp.width = 256;
          tmp.height = 192;
          const ctx = tmp.getContext("2d", { willReadFrequently: true });
          if (!ctx) return resolve(false);
          ctx.drawImage(img, 0, 0, tmp.width, tmp.height);
          const result = detectGermanDocument(tmp, side);
          resolve(result.detected);
        };
        img.onerror = () => resolve(false);
        img.src = dataUrl;
      });
    },
    [detectGermanDocument]
  );

  const handleScan = async () => {
    setIsScanning(true);
    setScanProgress(0);

    // Simulate scanning animation
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, 50);

    // Wait for animation to complete
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const image = captureImage();
    if (!image) {
      setIsScanning(false);
      autoScanTriggeredRef.current = false;
      toast({
        title: "Kamera liefert kein Bild",
        description: "Bitte Kamera neu starten und erneut versuchen.",
        variant: "destructive",
      });
      // Hard reset stream to avoid the "black preview" situation on mobile
      stopCamera();
      // allow UI to re-mount video element before restarting
      setTimeout(() => startCamera(), 150);
      return;
    }

    // Hard validation: do not proceed if neither AI nor heuristic detects a document.
    // We run a strict AI check on the captured image to avoid false positives.
    const side = scanStep === "scan-back" ? "back" : "front";

    let aiDetected = aiDetectionStatusRef.current === "confirmed";

    try {
      setAiDetectionStatus("checking");
      const { data, error } = await supabase.functions.invoke("detect-german-id", {
        body: { imageBase64: image, side },
      });
      if (error) throw error;

      const extractedCount = side === "front"
        ? [data?.surname, data?.givenNames, data?.dateOfBirth, data?.nationality, data?.placeOfBirth, data?.expiryDate].filter(Boolean).length
        : 0;

      const strictDetected = data?.detected === true && (side !== "front" || extractedCount >= 3);
      aiDetected = strictDetected;

      setAiDetectionMeta({ confidence: data?.confidence, reason: data?.reason });
      if (side === "front") {
        setExtractedIdData({
          surname: data?.surname ?? null,
          givenNames: data?.givenNames ?? null,
          dateOfBirth: data?.dateOfBirth ?? null,
          nationality: data?.nationality ?? null,
          placeOfBirth: data?.placeOfBirth ?? null,
          expiryDate: data?.expiryDate ?? null,
        });
      }

      setAiDetectionStatus(strictDetected ? "confirmed" : "idle");
    } catch (e) {
      console.error("[KYC] AI check on capture failed", e);
      setAiDetectionStatus("failed");
      // We continue with heuristic as a fallback.
    }

    const heuristicDetected = await validateGermanDocDataUrl(image, side);

    if (!aiDetected && !heuristicDetected) {
      setIsScanning(false);
      autoScanTriggeredRef.current = false;
      stabilityCounterRef.current = 0;
      documentCounterRef.current = 0;
      setDocumentDetected(false);
      setIsStable(false);
      setQualityStatus("no-document");
      toast({
        title: "Kein Ausweis erkannt",
        description: "Bitte den Ausweis vollständig in den Rahmen halten (Gesicht + Textfelder sichtbar, gute Beleuchtung).",
        variant: "destructive",
      });
      return;
    }

    if (scanStep === "scan-front") {
      setFrontImage(image);
      setIsScanning(false);

      // Stop camera and go to flip confirmation step
      stopCamera();
      
      // Reset detection states for when we restart for back scan
      autoScanTriggeredRef.current = false;
      stabilityCounterRef.current = 0;
      documentCounterRef.current = 0;
      setDocumentDetected(false);
      setIsStable(false);
      setQualityStatus("waiting");

      // Go to flip confirmation step instead of directly to back scan
      setScanStep("flip-document");
    } else if (scanStep === "scan-back") {
      setBackImage(image);
      setIsScanning(false);
      stopCamera();
      setScanStep("choose-method");
    }
  };

  const handleMethodSelect = (method: VerificationMethod) => {
    setVerificationMethod(method);
  };

  const handleSubmit = async (methodOverride?: VerificationMethod) => {
    if (submitInProgressRef.current) return;

    const method = methodOverride ?? verificationMethod;
    
    if (!user) {
      toast({
        title: "Nicht angemeldet",
        description: "Bitte melden Sie sich erneut an.",
        variant: "destructive",
      });
      return;
    }

    if (!frontImage) {
      toast({
        title: "Scan fehlt",
        description: "Bitte scannen Sie die Vorderseite Ihres Ausweises.",
        variant: "destructive",
      });
      return;
    }

    if (!method) {
      toast({
        title: "Methode fehlt",
        description: "Bitte wählen Sie eine Verifizierungsmethode.",
        variant: "destructive",
      });
      return;
    }

    submitInProgressRef.current = true;
    setUploading(true);
    console.log("[KYC] Starting upload process for user:", user.id);
    
    toast({
      title: "Verarbeitung läuft",
      description: "Ihre Dokumente werden hochgeladen und sicher verschlüsselt...",
    });

    const buildDocumentPayload = (
      dataUrl: string,
      docType: string,
      includeExtractedData: boolean
    ) => {
      const base64 = dataUrl.split(",")[1] ?? "";
      const fileSize = Math.floor((base64.length * 3) / 4);

      // Prevent saving "black"/empty captures to backend.
      if (fileSize < 5_000) {
        throw new Error("CAPTURE_TOO_SMALL");
      }

      const insertPayload: Record<string, any> = {
        user_id: user.id,
        document_type: docType,
        file_path: null,
        file_size: fileSize,
        mime_type: "image/jpeg",
        base64_content: dataUrl,
      };

      if (includeExtractedData && extractedIdData) {
        insertPayload.extracted_surname = extractedIdData.surname;
        insertPayload.extracted_given_names = extractedIdData.givenNames;
        insertPayload.extracted_date_of_birth = extractedIdData.dateOfBirth;
        insertPayload.extracted_nationality = extractedIdData.nationality;
        insertPayload.extracted_place_of_birth = extractedIdData.placeOfBirth;
        insertPayload.extracted_expiry_date = extractedIdData.expiryDate;
        insertPayload.ai_confidence = aiDetectionMeta?.confidence ?? null;
        insertPayload.ai_reason = aiDetectionMeta?.reason ?? null;
      }

      return insertPayload;
    };

    try {
      // Save both sides in one database request. The previous serial inserts and
      // cleanup queries made the mobile button wait through several PGP operations.
      const documents = [buildDocumentPayload(frontImage, `${selectedDocType}_front`, true)];
      if (backImage) {
        documents.push(buildDocumentPayload(backImage, `${selectedDocType}_back`, false));
      }

      console.log("[KYC] Saving document scans...");
      const { error: dbError } = await supabase
        .from("verification_uploads")
        .insert(documents as any);

      if (dbError) {
        console.error("[KYC] Database insert error:", dbError);
        throw new Error(`Datenbank-Fehler (Uploads): ${dbError.message}`);
      }

      // Update profile status only after both encrypted scans are safely stored.
      console.log("[KYC] Updating profile status...");
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          verification_requested_at: new Date().toISOString(),
          verification_method: method,
        })
        .eq("id", user.id);

      if (profileError) {
        console.error("[KYC] Profile update error:", profileError);
        throw new Error(`Datenbank-Fehler (Profil): ${profileError.message}`);
      }

      console.log("[KYC] Verification process completed successfully.");
      setScanStep("complete");

      toast({
        title: "Dokumente eingereicht",
        description: "Ihre Verifizierung wurde erfolgreich zur Prüfung übermittelt.",
      });

      setTimeout(() => {
        navigate("/dashboard");
      }, 3000);
    } catch (error: any) {
      console.error("[KYC] Overall verification error:", error);
      const msg = error.message || "Dokumente konnten nicht hochgeladen werden.";

      toast({
        title: "Fehler beim Abschluss",
        description: msg,
        variant: "destructive",
      });
    } finally {
      submitInProgressRef.current = false;
      setUploading(false);
    }
  };

  const resetScan = () => {
    setFrontImage(null);
    setBackImage(null);
    setVerificationMethod(null);
    setScanStep("scan-front");
    stopCamera();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Lade Verifizierung...</p>
        </div>
      </div>
    );
  }

  if (isVerified) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-3xl mx-auto">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zum Dashboard
          </Button>
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-600 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Bereits verifiziert</h3>
              <p className="text-muted-foreground">Ihr Konto wurde bereits verifiziert</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (verificationPending) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-3xl mx-auto">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zum Dashboard
          </Button>
          <Card>
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Dokumente werden geprüft</h3>
              <p className="text-muted-foreground mb-4">
                Ihre Dokumente wurden erfolgreich hochgeladen und werden nun von unserem Team überprüft.
              </p>
              <p className="text-sm text-muted-foreground">
                Sie erhalten eine Benachrichtigung, sobald die Verifizierung abgeschlossen ist.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="p-4">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück
        </Button>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-8">
        <AnimatePresence mode="wait">
          {/* Scanner View - Front and Back */}
            {(scanStep === "scan-front" || scanStep === "scan-back") && (
             <motion.div
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="space-y-6"
             >
              <div className="text-center mb-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={scanStep}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <h2 className="text-xl font-bold mb-1">
                      Personalausweis - {scanStep === "scan-front" ? "Vorderseite" : "Rückseite"}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      Halten Sie Ihren Ausweis in den Rahmen
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Camera View with Frame */}
              <div className="relative aspect-[4/3] bg-black rounded-2xl overflow-hidden">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  muted
                />

                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-4 z-30">
                    <p className="text-sm text-white/80">
                      Kamera ist nicht aktiv. Bitte Kamera-Zugriff erlauben.
                    </p>
                    <Button 
                      onClick={startCamera}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Kamera starten
                    </Button>
                  </div>
                )}
                
                {/* Scanning Frame (neutral) */}
                <div className="absolute inset-0 flex items-center justify-center p-8">
                  <motion.div
                    className="relative w-full h-full max-w-[320px] max-h-[200px]"
                    animate={isScanning ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ duration: 0.5, repeat: isScanning ? Infinity : 0 }}
                  >
                    {/* Corner brackets (always neutral; status shown via dots) */}
                    <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 rounded-tl-lg border-foreground/70" />
                    <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 rounded-tr-lg border-foreground/70" />
                    <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 rounded-bl-lg border-foreground/70" />
                    <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 rounded-br-lg border-foreground/70" />

                    {/* Scanning line animation */}
                    {isScanning && (
                      <motion.div
                        className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent"
                        initial={{ top: 0 }}
                        animate={{ top: "100%" }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                    )}
                  </motion.div>
                </div>

                {/* Dark overlay outside frame */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 bg-black/50" style={{
                    clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, calc(50% - 160px) calc(50% - 100px), calc(50% - 160px) calc(50% + 100px), calc(50% + 160px) calc(50% + 100px), calc(50% + 160px) calc(50% - 100px), calc(50% - 160px) calc(50% - 100px))"
                  }} />
                </div>

                {/* Debug Overlay Toggle */}
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="absolute top-2 right-2 z-50 bg-black/60 text-white text-xs px-2 py-1 rounded"
                >
                  {showDebug ? "Debug ✕" : "🔧"}
                </button>

                {/* Debug Overlay */}
                {showDebug && cameraActive && (
                  <div className="absolute bottom-16 left-2 right-2 z-40 bg-black/80 text-white text-[10px] font-mono p-2 rounded space-y-0.5 leading-tight">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={`font-bold ${
                        qualityStatus === "ready" ? "text-green-400" :
                        qualityStatus === "moving" ? "text-red-400" :
                        qualityStatus === "dark" ? "text-amber-400" :
                        qualityStatus === "no-document" ? "text-amber-300" : "text-gray-400"
                      }`}>{qualityStatus.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Edge (≥15):</span>
                      <span className={debugMetrics.avgEdge >= 15 ? "text-green-400" : "text-red-400"}>
                        {debugMetrics.avgEdge.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Contrast (≥60):</span>
                      <span className={debugMetrics.contrast >= 60 ? "text-green-400" : "text-red-400"}>
                        {debugMetrics.contrast.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Brightness (≥45):</span>
                      <span className={debugMetrics.avgBrightness >= 45 ? "text-green-400" : "text-red-400"}>
                        {debugMetrics.avgBrightness.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Light (≥0.20):</span>
                      <span className={debugMetrics.lightRatio >= 0.20 ? "text-green-400" : "text-red-400"}>
                        {(debugMetrics.lightRatio * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dark (≥0.025):</span>
                      <span className={debugMetrics.darkRatio >= 0.025 ? "text-green-400" : "text-red-400"}>
                        {(debugMetrics.darkRatio * 100).toFixed(2)}%
                      </span>
                    </div>
                    {scanStep === "scan-front" && (
                      <div className="flex justify-between">
                        <span>Color (≥0.015):</span>
                        <span className={debugMetrics.coloredRatio >= 0.015 ? "text-green-400" : "text-red-400"}>
                          {(debugMetrics.coloredRatio * 100).toFixed(2)}%
                        </span>
                      </div>
                    )}
                    <div className="border-t border-white/20 mt-1 pt-1 flex justify-between">
                      <span>Motion Diff (≤8):</span>
                      <span className={debugMetrics.motionDiff <= 8 ? "text-green-400" : "text-red-400"}>
                        {debugMetrics.motionDiff.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Stability (≥12):</span>
                      <span className={debugMetrics.stabilityCounter >= 12 ? "text-green-400" : "text-amber-400"}>
                        {debugMetrics.stabilityCounter}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Doc Counter (≥10):</span>
                      <span className={debugMetrics.documentCounter >= 10 ? "text-green-400" : "text-amber-400"}>
                        {debugMetrics.documentCounter.toFixed(1)}
                      </span>
                    </div>

                    <div className="border-t border-white/20 mt-1 pt-1 flex justify-between">
                      <span>AI:</span>
                      <span className={
                        aiDetectionStatus === "confirmed" ? "text-green-400" :
                        aiDetectionStatus === "checking" ? "text-amber-300" :
                        aiDetectionStatus === "failed" ? "text-red-400" : "text-gray-300"
                      }>
                        {aiDetectionStatus}
                      </span>
                    </div>
                    {aiDetectionMeta?.confidence && (
                      <div className="flex justify-between">
                        <span>AI Conf:</span>
                        <span className="text-gray-200">{aiDetectionMeta.confidence}</span>
                      </div>
                    )}
                    {aiDetectionMeta?.reason && (
                      <div className="mt-0.5 text-gray-200">
                        <span className="text-gray-400">AI Reason:</span> {aiDetectionMeta.reason}
                      </div>
                    )}

                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void triggerAiDetection()}
                        className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 border border-white/15"
                      >
                        Jetzt KI prüfen
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          stabilityCounterRef.current = 0;
                          documentCounterRef.current = 0;
                          aiCheckCounterRef.current = 0;
                          setAiDetectionStatus("idle");
                          setAiDetectionMeta(null);
                        }}
                        className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 border border-white/15"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}

                {/* Progress indicator */}
                {isScanning && (
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-green-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${scanProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Compact status dots (no text banners) */}
                {cameraActive && !isScanning && (
                  <div className="absolute top-3 left-3">
                    <div className="flex items-center gap-1">
                      <span className="sr-only">Status: {qualityStatus}</span>
                      <span
                        className={
                          "h-1.5 w-1.5 rounded-full " +
                          (qualityStatus === "ready"
                            ? "bg-primary"
                            : qualityStatus === "moving"
                            ? "bg-destructive"
                            : qualityStatus === "dark" || qualityStatus === "no-document"
                            ? "bg-secondary"
                            : "bg-muted-foreground")
                        }
                      />
                      <span
                        className={
                          "h-1.5 w-1.5 rounded-full " +
                          (qualityStatus === "ready"
                            ? "bg-primary/70"
                            : qualityStatus === "moving"
                            ? "bg-destructive/70"
                            : qualityStatus === "dark" || qualityStatus === "no-document"
                            ? "bg-secondary/70"
                            : "bg-muted-foreground/70")
                        }
                      />
                      <span
                        className={
                          "h-1.5 w-1.5 rounded-full " +
                          (qualityStatus === "ready"
                            ? "bg-primary/40"
                            : qualityStatus === "moving"
                            ? "bg-destructive/40"
                            : qualityStatus === "dark" || qualityStatus === "no-document"
                            ? "bg-secondary/40"
                            : "bg-muted-foreground/40")
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Flip animation indicator */}
              {scanStep === "scan-back" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-2"
                >
                  <motion.div
                    animate={{ rotateY: [0, 180, 360] }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full"
                  >
                    <RotateCcw className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Dokument umgedreht</span>
                  </motion.div>
                </motion.div>
              )}

              <div className="flex justify-center gap-3">
                <Button
                  onClick={handleScan}
                  disabled={!cameraActive || isScanning}
                >
                  Jetzt scannen
                </Button>
                <Button 
                  variant="outline" 
                  onClick={resetScan}
                >
                  Abbrechen
                </Button>
              </div>

              {/* Info text */}
              <p className="text-center text-xs text-muted-foreground">
                Halten Sie Ihren deutschen Personalausweis oder Aufenthaltstitel ruhig in den Rahmen. Der Scan startet automatisch.
              </p>
            </motion.div>
          )}

          {/* Step 3b: Flip Document - Auto-transition after 3 seconds */}
          {scanStep === "flip-document" && (
            <motion.div
              key="flip-document"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                >
                  <CheckCircle2 className="h-16 w-16 mx-auto text-green-600 mb-4" />
                </motion.div>
                <h2 className="text-xl font-bold mb-1">Vorderseite erfolgreich gescannt</h2>
                <p className="text-muted-foreground">Drehen Sie jetzt Ihr Dokument um</p>
              </div>

              {/* Preview of front image */}
              {frontImage && (
                <div className="flex justify-center mb-6">
                  <div className="w-32 h-20 rounded-lg overflow-hidden border-2 border-green-500 shadow-lg">
                    <img src={frontImage} alt="Vorderseite" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}

              {/* Flip animation with countdown */}
              <motion.div 
                className="flex flex-col items-center gap-4 py-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <motion.div
                  animate={{ rotateY: [0, 180, 360] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="w-24 h-16 bg-gradient-to-br from-primary/20 to-primary/40 rounded-lg flex items-center justify-center border-2 border-primary/50"
                >
                  <RotateCcw className="h-8 w-8 text-primary" />
                </motion.div>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Drehen Sie Ihren Ausweis auf die Rückseite
                </p>
              </motion.div>
            </motion.div>
          )}

          {/* Step 4: Choose Verification Method */}
          {scanStep === "choose-method" && (
            <motion.div
              key="choose-method"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                >
                  <CheckCircle2 className="h-16 w-16 mx-auto text-green-600 mb-4" />
                </motion.div>
                <h2 className="text-xl font-bold mb-1 text-center">Scans erfolgreich erfasst</h2>
              </div>

              {/* Preview of scanned images */}
              <div className="flex gap-4 justify-center mb-6">
                {frontImage && (
                  <div className="w-24 h-16 rounded-lg overflow-hidden border-2 border-green-500">
                    <img src={frontImage} alt="Vorderseite" className="w-full h-full object-cover" />
                  </div>
                )}
                {backImage && (
                  <div className="w-24 h-16 rounded-lg overflow-hidden border-2 border-green-500">
                    <img src={backImage} alt="Rückseite" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Starter Jobs Preview */}
              <StarterJobsPreview 
                searchingJobs={searchingJobs}
                starterTasks={starterTasks}
                onSearchComplete={() => setSearchingJobs(false)}
              />

              <div className="flex gap-4 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={resetScan}
                >
                  Zurück
                </Button>
                <Button 
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={async () => {
                    setVerificationMethod("pending");
                    await handleSubmit("pending");
                  }}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Wird verarbeitet...
                    </>
                  ) : (
                    "Bestätigen"
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 5: Complete */}
          {scanStep === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6 py-6"
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                >
                  <CheckCircle2 className="h-16 w-16 mx-auto text-green-600 mb-4" />
                </motion.div>
                <h2 className="text-2xl font-bold mb-2">Verifizierung eingereicht</h2>
                <p className="text-muted-foreground">
                  Ihre Daten werden geprüft. Sobald die Verifizierung abgeschlossen ist, können Sie loslegen.
                </p>
              </div>
              
              {/* Show locked starter jobs */}
              <StarterJobsPreview 
                searchingJobs={false}
                starterTasks={starterTasks}
                showLockMessage
              />
              
              <p className="text-sm text-center text-muted-foreground">
                Sie werden in Kürze zum Dashboard weitergeleitet...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Verification;
