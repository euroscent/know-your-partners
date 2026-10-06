import { useEffect, useState } from "react";
import { PageLoader } from "@/components/PageLoader";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, CheckCircle2, XCircle, Upload, Eye, Mail, Link, RefreshCw, Copy, Plus } from "lucide-react";
import { toast } from "@/lib/toast-stub";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TaskSubmission {
  id: string;
  task_id: string;
  employee_id: string;
  step_responses: any[];
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  notes: string | null;
  admin_data?: Record<string, any>;
}

interface Task {
  id: string;
  title: string;
  steps: any[];
}

interface Employee {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface PhoneNumber {
  id: string;
  phone_number: string;
  country: string | null;
  status: string;
  assigned_to: string | null;
}

interface EmailAccount {
  id: string;
  email_address: string;
  status: string;
  assigned_to: string | null;
}

interface EmailDomain {
  id: string;
  domain: string;
  is_active: boolean;
}

interface GeneratedEmail {
  id: string;
  full_address: string;
  user_id: string | null;
  submission_id: string | null;
  task_id: string | null;
  is_active: boolean;
}

interface ReceivedEmail {
  id: string;
  from_address: string;
  to_address: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
}

// Word list for generating human-readable email addresses (moved outside component)
const EMAIL_WORD_LIST = [
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
  "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
  "action", "actor", "actress", "actual", "adapt", "add", "addict", "address", "adjust", "admit",
  "adult", "advance", "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent",
  "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album", "alcohol", "alert",
  "alien", "all", "alley", "allow", "almost", "alone", "alpha", "already", "also", "alter",
  "always", "amateur", "amazing", "among", "amount", "amused", "analyst", "anchor", "ancient", "anger",
  "angle", "angry", "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique",
  "apple", "approve", "april", "arch", "arctic", "area", "arena", "argue", "arm", "armed",
  "armor", "army", "around", "arrange", "arrest", "arrive", "arrow", "art", "artefact", "artist",
  "bacon", "badge", "bag", "balance", "balcony", "ball", "bamboo", "banana", "banner", "bar",
  "barrel", "base", "basic", "basket", "battle", "beach", "bean", "beauty", "become", "beef",
  "believe", "belt", "bench", "benefit", "best", "better", "beyond", "bicycle", "bike", "bird",
  "birth", "bitter", "black", "blade", "blame", "blanket", "blast", "bleak", "bless", "blind",
  "blood", "blossom", "blue", "blur", "board", "boat", "body", "boil", "bomb", "bone", "bonus",
  "book", "boost", "border", "borrow", "boss", "bottom", "bounce", "box", "bracket", "brain",
  "brand", "brass", "brave", "bread", "breeze", "brick", "bridge", "brief", "bright", "bring",
  "bronze", "broom", "brown", "brush", "bubble", "buddy", "budget", "buffalo", "build", "bulb",
  "bulk", "bundle", "bunker", "burden", "burger", "burst", "bus", "busy", "butter", "buyer",
  "cabbage", "cabin", "cable", "cactus", "cage", "cake", "call", "calm", "camera", "camp",
  "canal", "cancel", "candy", "cannon", "canoe", "canvas", "canyon", "capable", "capital", "captain",
  "carbon", "card", "cargo", "carpet", "carry", "cart", "case", "cash", "castle", "casual",
  "catalog", "catch", "cattle", "cause", "cave", "ceiling", "celery", "cement", "century", "cereal",
  "chair", "chalk", "change", "chaos", "chapter", "charge", "chase", "chat", "check", "cheese",
  "chef", "cherry", "chest", "chief", "child", "choice", "chunk", "circle", "citizen", "claim",
  "clap", "clarify", "claw", "clay", "clean", "clerk", "clever", "click", "client", "cliff",
  "climb", "clinic", "clip", "clock", "close", "cloth", "cloud", "clown", "club", "clump",
  "cluster", "clutch", "coach", "coast", "coconut", "code", "coffee", "coil", "coin", "collect",
  "color", "column", "combine", "come", "comfort", "comic", "common", "company", "concert", "conduct",
  "confirm", "congress", "connect", "control", "convince", "cook", "cool", "copper", "coral", "core",
  "corn", "correct", "cost", "cotton", "couch", "country", "couple", "course", "cousin", "cover",
  "coyote", "crack", "cradle", "craft", "crane", "crash", "crater", "crawl", "crazy", "cream",
  "credit", "creek", "crew", "cricket", "crime", "crisp", "critic", "crop", "cross", "crowd",
  "crucial", "cruel", "cruise", "crunch", "crush", "crystal", "cube", "culture", "cup", "cupboard",
  "curious", "current", "curtain", "curve", "cushion", "custom", "cute", "cycle", "dance", "danger",
  "daring", "dawn", "debate", "decade", "december", "decide", "decline", "decorate", "decrease", "deer",
  "defense", "define", "demand", "denial", "dentist", "deny", "depart", "depend", "deposit", "depth",
  "desert", "design", "desk", "detail", "develop", "device", "devote", "diagram", "dial", "diamond",
  "diary", "diesel", "diet", "differ", "digital", "dignity", "dilemma", "dinner", "dinosaur", "direct",
  "dirt", "disagree", "discover", "disease", "dish", "dismiss", "display", "distance", "divide", "doctor",
  "dolphin", "domain", "donkey", "donor", "door", "dose", "double", "dove", "draft", "dragon",
  "drama", "draw", "dream", "dress", "drift", "drill", "drink", "drive", "drop", "drum",
  "duck", "dumb", "dune", "during", "dust", "dutch", "duty", "dwarf", "eagle", "early",
  "earth", "easily", "east", "easy", "echo", "ecology", "economy", "edge", "edit", "educate",
  "effort", "eight", "either", "elbow", "elder", "elegant", "element", "elephant", "elite", "ember",
  "embrace", "emerge", "emotion", "employ", "empower", "empty", "enable", "end", "endless", "endorse",
  "enemy", "energy", "enforce", "engage", "engine", "enhance", "enjoy", "enlist", "enough", "enrich",
  "enroll", "ensure", "enter", "entire", "entry", "envelope", "episode", "equal", "equip", "erase",
  "erode", "escape", "essay", "essence", "estate", "eternal", "ethics", "evidence", "evil", "evolve",
  "exact", "example", "excess", "exchange", "excite", "exclude", "excuse", "execute", "exercise", "exile",
  "exist", "expand", "expect", "expire", "explain", "export", "express", "extend", "extra", "fabric",
  "face", "faculty", "fade", "faint", "faith", "fall", "false", "fame", "family", "famous",
  "fancy", "fantasy", "farm", "fashion", "fatal", "father", "fatigue", "fault", "favorite", "feature",
  "february", "federal", "feed", "feel", "female", "fence", "festival", "fever", "fiber", "fiction",
  "field", "figure", "file", "film", "filter", "final", "find", "finger", "finish", "fire",
  "firm", "first", "fiscal", "fish", "fitness", "flag", "flame", "flash", "flat", "flavor",
  "flesh", "flight", "flip", "float", "flock", "floor", "flower", "fluid", "flush", "foam",
  "focus", "fog", "foil", "fold", "follow", "food", "foot", "force", "forest", "forget",
  "fork", "fortune", "forum", "forward", "fossil", "foster", "found", "fox", "fragile", "frame",
  "frequent", "fresh", "friend", "fringe", "frog", "front", "frost", "frown", "frozen", "fruit",
  "fuel", "fun", "funny", "furnace", "fury", "future", "gadget", "gain", "galaxy", "gallery",
  "game", "gap", "garage", "garbage", "garden", "garlic", "garment", "gate", "gather", "gauge",
  "gaze", "general", "genius", "genre", "gentle", "genuine", "gesture", "ghost", "giant", "gift",
  "giggle", "ginger", "giraffe", "girl", "give", "glad", "glance", "glare", "glass", "glide",
  "glimpse", "globe", "gloom", "glory", "glove", "glow", "glue", "goat", "goddess", "gold",
  "good", "goose", "gorilla", "gospel", "gossip", "govern", "gown", "grab", "grace", "grain",
  "grape", "grass", "gravity", "great", "green", "grid", "grief", "grit", "grocery", "group",
  "grow", "guard", "guess", "guide", "guitar", "gun", "gym", "habit", "hair", "half",
  "hammer", "hamster", "hand", "happy", "harbor", "hard", "harvest", "hat", "hawk", "hazard",
  "head", "health", "heart", "heavy", "hedge", "height", "hello", "helmet", "help", "hero",
  "hidden", "high", "hill", "hint", "hip", "hire", "history", "hobby", "hockey", "hold",
  "hole", "holiday", "hollow", "home", "honey", "hood", "hope", "horn", "horror", "horse",
  "hospital", "host", "hotel", "hour", "hover", "hub", "huge", "human", "humble", "humor",
  "hundred", "hungry", "hunt", "hurdle", "hurry", "hurt", "husband", "hybrid", "ice", "icon",
  "idea", "identify", "idle", "ignore", "illegal", "illness", "image", "imitate", "immune", "impact",
  "impose", "improve", "impulse", "inch", "include", "income", "index", "indicate", "indoor", "industry",
  "infant", "inflict", "inform", "inhale", "inherit", "initial", "inject", "injury", "inmate", "inner",
  "innocent", "input", "inquiry", "insane", "insect", "inside", "inspire", "install", "intact", "interest",
  "into", "invest", "invite", "involve", "iron", "island", "isolate", "issue", "item", "ivory",
  "jacket", "jaguar", "jazz", "jealous", "jeans", "jelly", "jewel", "job", "join", "joke",
  "journey", "joy", "judge", "juice", "jump", "jungle", "junior", "junk", "just", "kangaroo",
  "keen", "keep", "ketchup", "key", "kick", "kidney", "kind", "kingdom", "kiss", "kitchen",
  "kite", "kitten", "kiwi", "knee", "knife", "knock", "know", "label", "labor", "ladder",
  "lady", "lake", "lamp", "language", "laptop", "large", "later", "latin", "laugh", "laundry",
  "lawn", "lawsuit", "layer", "lazy", "leader", "leaf", "learn", "leave", "lecture", "legal",
  "legend", "leisure", "lemon", "lend", "length", "lens", "leopard", "lesson", "letter", "level",
  "liberty", "library", "license", "life", "lift", "light", "limit", "line", "lion", "liquid",
  "list", "little", "live", "lizard", "load", "loan", "lobster", "local", "lock", "logic",
  "lonely", "long", "loop", "lottery", "loud", "lounge", "love", "loyal", "lucky", "lumber"
];

// Generate random word-based local part (2-3 words)
const generateRandomLocalPart = () => {
  const wordCount = Math.random() < 0.5 ? 2 : 3;
  const selectedWords: string[] = [];
  const usedIndices = new Set<number>();
  
  while (selectedWords.length < wordCount) {
    const randomIndex = Math.floor(Math.random() * EMAIL_WORD_LIST.length);
    if (!usedIndices.has(randomIndex)) {
      usedIndices.add(randomIndex);
      selectedWords.push(EMAIL_WORD_LIST[randomIndex]);
    }
  }
  
  return selectedWords.join(".");
};

const VideoChat = () => {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [selectedSubmission, setSelectedSubmission] = useState<TaskSubmission | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [adminData, setAdminData] = useState<Record<string, string>>({});
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [savingDemoData, setSavingDemoData] = useState(false);
  const [availablePhones, setAvailablePhones] = useState<PhoneNumber[]>([]);
  const [availableEmails, setAvailableEmails] = useState<EmailAccount[]>([]);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [generatedEmails, setGeneratedEmails] = useState<GeneratedEmail[]>([]);
  const [receivedEmails, setReceivedEmails] = useState<ReceivedEmail[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [emailDomains, setEmailDomains] = useState<EmailDomain[]>([]);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [infoFromPrevious, setInfoFromPrevious] = useState(false);
  const [selectedCustomEmail, setSelectedCustomEmail] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAndFetchData();
  }, []);

  // Auto-save admin data when it changes
  useEffect(() => {
    if (!selectedSubmission) return;
    
    // Clear existing timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }
    
    // Set new timeout to save after 1 second of no changes
    const timeout = setTimeout(async () => {
      if (Object.keys(adminData).length > 0) {
        console.log('=== AUTO-SAVE ===');
        console.log('Current admin data:', adminData);
        
        // Remove blob URLs before saving
        const dataToSave = { ...adminData };
        if (dataToSave.image_url && dataToSave.image_url.startsWith('blob:')) {
          console.log('Removing blob URL from auto-save');
          delete dataToSave.image_url;
        }
        
        console.log('Auto-saving to DB:', dataToSave);
        const { error } = await supabase
          .from("task_submissions")
          .update({
            admin_data: dataToSave,
          } as any)
          .eq("id", selectedSubmission.id);
        
        if (!error) {
          console.log("✓ Demo-Daten automatisch gespeichert");
        } else {
          console.error('Auto-save error:', error);
        }
      }
    }, 1000);
    
    setAutoSaveTimeout(timeout);
    
    // Cleanup
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [adminData, selectedSubmission]);

  const checkAdminAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const adminStatus = roles?.some((r) => r.role === "admin") || false;
    if (!adminStatus) {
      navigate("/dashboard");
      return;
    }

    await fetchSubmissions();
    setLoading(false);
  };

  const fetchSubmissions = async () => {
    // Erst Admin-IDs holen um sie auszufiltern
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    
    const adminIds = new Set(adminRoles?.map(r => r.user_id) || []);

    // Fetch ALL submissions - konstant angezeigt bis endgültig approved
    // Nur approved werden ausgeblendet (finaler Abschluss durch Admin)
    const { data: submissionsData, error: submissionsError } = await supabase
      .from("task_submissions")
      .select(`
        *,
        tasks!inner (
          id,
          title,
          steps,
          assigned_to
        )
      `)
      .neq("status", "approved")
      .order("employee_id", { ascending: true })
      .order("submitted_at", { ascending: false });

    if (submissionsError) {
      console.error("Error fetching submissions:", submissionsError);
      toast.error("Fehler beim Laden der Anfragen");
      return;
    }

    // Filter: Nur Submissions wo der Task existiert UND nicht von Admins
    const filteredSubmissions = (submissionsData as any[])?.filter(sub => {
      // Task muss existieren
      if (sub.tasks == null) return false;
      // Admin-Submissions ausfiltern
      if (adminIds.has(sub.employee_id)) return false;
      return true;
    }) || [];

    // Duplikate entfernen - nur die neueste Submission pro task_id + employee_id behalten
    const uniqueSubmissions = filteredSubmissions.reduce((acc: any[], sub) => {
      const key = `${sub.task_id}_${sub.employee_id}`;
      const existingIndex = acc.findIndex(s => `${s.task_id}_${s.employee_id}` === key);
      
      if (existingIndex === -1) {
        // Noch nicht vorhanden, hinzufügen
        acc.push(sub);
      } else {
        // Existiert bereits - die neuere behalten
        const existing = acc[existingIndex];
        if (new Date(sub.submitted_at) > new Date(existing.submitted_at)) {
          acc[existingIndex] = sub;
        }
      }
      return acc;
    }, []);

    // System-Felder die nicht als "echte" Admin-Daten zählen
    const systemFields = [
      'current_step_index', 
      'last_section', 
      'restart_from_step',
      'postal_documents_completed',
      'postal_documents_completed_at',
      'quality_check',
      'sms_forwarded',
      'sms_forwarded_at',
      'anosim_response'
    ];
    
    // Prüfen ob echte Admin-Daten vorhanden sind (nicht nur System-Felder)
    const hasRealAdminData = (adminData: Record<string, any> | null): boolean => {
      if (!adminData) return false;
      return Object.keys(adminData).some(
        key => !systemFields.includes(key) && adminData[key] !== null && adminData[key] !== undefined
      );
    };
    
    // NUR Einträge anzeigen wo der Mitarbeiter Demo-Daten beantragt und zugestimmt hat
    // Das sind ausschließlich Einträge mit status === 'pending' (Ausstehend)
    const needsAdminDataSubmissions = uniqueSubmissions.filter(sub => sub.status === 'pending');
    
    // Sortieren: "pending" zuerst, dann nach Datum (neueste zuerst)
    const sortedSubmissions = needsAdminDataSubmissions.sort((a, b) => {
      // Priorität 1: Status "pending" (Ausstehend) IMMER ganz oben
      const aIsPending = a.status === 'pending';
      const bIsPending = b.status === 'pending';
      
      if (aIsPending && !bIsPending) return -1;
      if (!aIsPending && bIsPending) return 1;
      
      // Priorität 2: Nach Datum (neueste zuerst)
      return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
    });

    console.log("Filtered submissions (needs admin data):", sortedSubmissions.length, sortedSubmissions);

    setSubmissions(sortedSubmissions);

    // Fetch available phone numbers
    const { data: phonesData } = await supabase
      .from("phone_numbers")
      .select("id, phone_number, country, status, assigned_to")
      .in("status", ["available", "assigned"])
      .order("created_at", { ascending: false });

    setAvailablePhones(phonesData || []);

    // Fetch available email accounts
    const { data: emailsData } = await supabase
      .from("email_accounts")
      .select("id, email_address, status, assigned_to")
      .in("status", ["available", "assigned"])
      .order("created_at", { ascending: false });

    setAvailableEmails(emailsData || []);

    // Fetch generated emails for all submissions
    const submissionIds = uniqueSubmissions.map(s => s.id);
    const employeeIds = [...new Set(uniqueSubmissions.map(s => s.employee_id))];
    
    if (submissionIds.length > 0 || employeeIds.length > 0) {
      const { data: genEmailsData } = await supabase
        .from("generated_emails")
        .select("*")
        .eq("is_active", true)
        .or(`submission_id.in.(${submissionIds.join(',')}),user_id.in.(${employeeIds.join(',')})`);
      
      setGeneratedEmails(genEmailsData || []);
    }

    // Fetch email domains for generating new emails
    const { data: domainsData } = await supabase
      .from("email_domains")
      .select("id, domain, is_active")
      .eq("is_active", true);
    
    setEmailDomains(domainsData || []);

    // Build tasks map from unique submissions
    const tasksMap: Record<string, Task> = {};
    uniqueSubmissions.forEach((sub: any) => {
      if (sub.tasks) {
        tasksMap[sub.tasks.id] = sub.tasks;
      }
    });
    setTasks(tasksMap);

    // Fetch related employees
    const empIds = [...new Set(uniqueSubmissions.map(s => s.employee_id))] as string[];
    if (empIds.length > 0) {
      const { data: employeesData } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .in("id", empIds);

      const employeesMap: Record<string, Employee> = {};
      employeesData?.forEach((emp: any) => {
        employeesMap[emp.id] = emp;
      });
      setEmployees(employeesMap);
    }
  };

  // Fetch received emails for a specific generated email address
  const fetchReceivedEmails = async (emailAddress: string) => {
    setLoadingEmails(true);
    const { data: emails, error } = await supabase
      .from("received_emails")
      .select("*")
      .eq("to_address", emailAddress)
      .order("received_at", { ascending: false })
      .limit(10);
    
    if (error) {
      console.error("Error fetching received emails:", error);
    } else {
      setReceivedEmails(emails || []);
    }
    setLoadingEmails(false);
  };

  // Extract verification codes and links from email content
  const extractCodesAndLinks = (text: string | null, html: string | null): { codes: string[], links: string[] } => {
    const codes: string[] = [];
    const links: string[] = [];
    
    const content = text || html || "";
    
    // Extract numeric codes (4-8 digits)
    const codeMatches = content.match(/\b\d{4,8}\b/g);
    if (codeMatches) {
      codes.push(...codeMatches);
    }
    
    // Extract links (http/https URLs)
    const linkMatches = content.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g);
    if (linkMatches) {
      // Filter out common non-verification links
      const filteredLinks = linkMatches.filter(link => 
        !link.includes('unsubscribe') && 
        !link.includes('privacy') && 
        !link.includes('terms') &&
        !link.includes('.png') &&
        !link.includes('.jpg') &&
        !link.includes('.gif')
      );
      links.push(...filteredLinks);
    }
    
    return { codes: [...new Set(codes)], links: [...new Set(links)] };
  };

  // Get ALL assigned generated emails for an employee/submission
  const getAssignedGeneratedEmails = (employeeId: string, submissionId: string): GeneratedEmail[] => {
    return generatedEmails.filter(ge => 
      ge.submission_id === submissionId || ge.user_id === employeeId
    );
  };

  // Get assigned Outlook email accounts for an employee
  const getAssignedOutlookEmails = (employeeId: string): EmailAccount[] => {
    return availableEmails.filter(email => email.assigned_to === employeeId);
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Kopiert!");
  };


  // Generate and assign custom email to submission
  const generateAndAssignEmail = async (domainId: string) => {
    if (!selectedSubmission) return;
    
    setGeneratingEmail(true);
    
    const domain = emailDomains.find(d => d.id === domainId);
    if (!domain) {
      toast.error("Domain nicht gefunden");
      setGeneratingEmail(false);
      return;
    }
    
    // Generate unique word-based local part
    const localPart = generateRandomLocalPart();
    const fullAddress = `${localPart}@${domain.domain}`;
    
    // Insert into generated_emails
    const { data: newEmail, error } = await supabase
      .from("generated_emails")
      .insert({
        domain_id: domainId,
        local_part: localPart,
        full_address: fullAddress,
        user_id: selectedSubmission.employee_id,
        submission_id: selectedSubmission.id,
        task_id: selectedSubmission.task_id,
        is_active: true,
      })
      .select()
      .single();
    
    if (error) {
      console.error("Error generating email:", error);
      toast.error("Fehler beim Generieren der E-Mail");
      setGeneratingEmail(false);
      return;
    }
    
    // Update local state
    setGeneratedEmails([...generatedEmails, newEmail]);
    
    // Also store in admin_data
    const newAdminData = { 
      ...adminData, 
      custom_email: fullAddress,
      custom_email_id: newEmail.id
    };
    setAdminData(newAdminData);
    
    // Persist to submission
    await supabase
      .from("task_submissions")
      .update({ admin_data: newAdminData } as any)
      .eq("id", selectedSubmission.id);
    
    toast.success("E-Mail-Adresse generiert");
    setGeneratingEmail(false);
  };

  const handleFileUpload = async (fieldName: string, file: File) => {
    console.log('=== FILE UPLOAD START ===');
    console.log('Field name:', fieldName);
    console.log('File:', file.name, file.type, file.size);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !selectedSubmission) {
      console.error('No session or submission');
      return;
    }

    setUploadingFiles({ ...uploadingFiles, [fieldName]: true });

    const fileExt = file.name.split('.').pop();
    const fileName = `admin/${selectedSubmission.id}/${fieldName}-${Date.now()}.${fileExt}`;
    console.log('Upload path:', fileName);

    const { error: uploadError } = await supabase.storage
      .from('kyc-uploads')
      .upload(fileName, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      toast.error("Fehler beim Hochladen");
      setUploadingFiles({ ...uploadingFiles, [fieldName]: false });
      return;
    }
    console.log('✓ Upload successful');

    // Download the file as blob to avoid CORS issues
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('kyc-uploads')
      .download(fileName);

    if (downloadError || !fileBlob) {
      console.error("Download error:", downloadError);
      toast.error("Fehler beim Laden der Datei");
      setUploadingFiles({ ...uploadingFiles, [fieldName]: false });
      return;
    }
    console.log('✓ Download successful, blob size:', fileBlob.size);

    // Create blob URL for display and store file path for later retrieval
    const blobUrl = URL.createObjectURL(fileBlob);
    console.log('✓ Blob URL created:', blobUrl);
    
    // Store both the blob URL (for immediate display) and the file path (for saving to DB)
    const newAdminData = { 
      ...adminData, 
      [fieldName]: blobUrl, 
      [`${fieldName}_path`]: fileName 
    };
    console.log('New admin data:', newAdminData);
    
    // Immediately save to database with only the path
    const dataToSave = { ...newAdminData };
    if (dataToSave[fieldName] && dataToSave[fieldName].startsWith('blob:')) {
      console.log('Removing blob URL from save data');
      delete dataToSave[fieldName];
    }
    console.log('Data to save to DB:', dataToSave);
    
    const { error: saveError } = await supabase
      .from("task_submissions")
      .update({
        admin_data: dataToSave,
      } as any)
      .eq("id", selectedSubmission.id);
    
    if (saveError) {
      console.error('Save error:', saveError);
    } else {
      console.log('✓ Saved to database');
    }
    
    setAdminData(newAdminData);
    setUploadingFiles({ ...uploadingFiles, [fieldName]: false });
    toast.success("Datei hochgeladen");
    console.log('=== FILE UPLOAD END ===');
  };

  const handlePhoneAssignment = async (phoneNumberId: string) => {
    if (!selectedSubmission) return;

    const selectedPhone = availablePhones.find(p => p.id === phoneNumberId);
    if (!selectedPhone) return;

    // Update phone_numbers table to assign to employee
    const { error: assignError } = await supabase
      .from("phone_numbers")
      .update({ 
        assigned_to: selectedSubmission.employee_id,
        status: 'assigned'
      })
      .eq("id", phoneNumberId);

    if (assignError) {
      console.error("Error assigning phone:", assignError);
      toast.error("Fehler beim Zuweisen der Nummer");
      return;
    }

    // Persist phone immediately in submission admin_data so Mitarbeiter sieht sie
    const newAdminData = { ...(selectedSubmission.admin_data as Record<string, any> || {}), phone: selectedPhone.phone_number, phone_id: phoneNumberId };
    const { error: updateSubmissionError } = await supabase
      .from("task_submissions")
      .update({ admin_data: newAdminData } as any)
      .eq("id", selectedSubmission.id);

    if (updateSubmissionError) {
      console.error("Error updating submission admin_data:", updateSubmissionError);
      toast.error("Nummer zugewiesen, aber Speichern in Aufgabe fehlgeschlagen");
    } else {
      setAdminData({ ...adminData, phone: selectedPhone.phone_number, phone_id: phoneNumberId });
      toast.success("Nummer zugewiesen");
    }

    fetchSubmissions();
  };

  const handleEmailAssignment = async (emailAccountId: string) => {
    if (!selectedSubmission) return;

    const selectedEmail = availableEmails.find(e => e.id === emailAccountId);
    if (!selectedEmail) return;

    // Update email_accounts table to assign to employee
    const { error: assignError } = await supabase
      .from("email_accounts")
      .update({ 
        assigned_to: selectedSubmission.employee_id,
        status: 'assigned'
      })
      .eq("id", emailAccountId);

    if (assignError) {
      console.error("Error assigning email:", assignError);
      toast.error("Fehler beim Zuweisen des E-Mail-Kontos");
      return;
    }

    // Persist email immediately in submission admin_data
    const newAdminData = { 
      ...(selectedSubmission.admin_data as Record<string, any> || {}), 
      email_account: selectedEmail.email_address, 
      email_account_id: emailAccountId,
      email_forwarding_enabled: true
    };
    const { error: updateSubmissionError } = await supabase
      .from("task_submissions")
      .update({ admin_data: newAdminData } as any)
      .eq("id", selectedSubmission.id);

    if (updateSubmissionError) {
      console.error("Error updating submission admin_data:", updateSubmissionError);
      toast.error("E-Mail-Konto zugewiesen, aber Speichern fehlgeschlagen");
    } else {
      setAdminData({ 
        ...adminData, 
        email_account: selectedEmail.email_address, 
        email_account_id: emailAccountId,
        email_forwarding_enabled: 'true'
      });
      toast.success("E-Mail-Weiterleitung aktiviert");
    }

    fetchSubmissions();
  };

  const handleSaveDemoData = async () => {
    if (!selectedSubmission) return;

    setSavingDemoData(true);

    const mergedAdminData = { ...(selectedSubmission.admin_data as Record<string, any> || {}), ...adminData };
    
    // Remove blob URLs before saving, keep only paths
    const dataToSave = { ...mergedAdminData };
    if (dataToSave.image_url && dataToSave.image_url.startsWith('blob:')) {
      delete dataToSave.image_url;
    }

    const { error } = await supabase
      .from("task_submissions")
      .update({
        admin_data: Object.keys(dataToSave).length > 0 ? dataToSave : null,
        status: "in_progress", // Demo-Daten bereitgestellt - User kann jetzt arbeiten
      } as any)
      .eq("id", selectedSubmission.id);

    if (error) {
      console.error("Error saving demo data:", error);
      toast.error("Fehler beim Speichern");
      setSavingDemoData(false);
      return;
    }

    toast.success("Demo-Daten gespeichert");
    setSavingDemoData(false);
    setSelectedSubmission(null);
    setAdminData({});
    setInfoFromPrevious(false);
    fetchSubmissions();
  };

  const handleReview = async (submissionId: string, newStatus: "approved" | "rejected") => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setReviewing(true);

    // Combine admin data and preserve existing on rejection
    const mergedAdminData = { ...(selectedSubmission?.admin_data as Record<string, any> || {}), ...adminData };
    const updateData = {
      status: newStatus === "approved" ? "in_progress" : "rejected", // in_progress = Demo-Daten bereit, User kann arbeiten
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.user.id,
      admin_data: Object.keys(mergedAdminData).length > 0 ? mergedAdminData : null,
    };

    const { error } = await supabase
      .from("task_submissions")
      .update(updateData as any)
      .eq("id", submissionId);

    if (error) {
      console.error("Error reviewing submission:", error);
      toast.error("Fehler beim Überprüfen");
      setReviewing(false);
      return;
    }

    toast.success(newStatus === "approved" ? "Genehmigt" : "Abgelehnt");
    setSelectedSubmission(null);
    setAdminData({});
    setReviewing(false);
    fetchSubmissions();
  };

  const getStatusBadge = (status: string, hasAdminData?: boolean) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Ausstehend</Badge>;
      case "in_progress":
        return <Badge className="bg-green-600/80 text-white">In Bearbeitung</Badge>;
      case "approved":
        return <Badge className="bg-green-600 text-white">Abgeschlossen</Badge>;
      case "rejected":
        return <Badge variant="destructive">Abgelehnt</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getDataAddedBadge = (submission: TaskSubmission) => {
    const adminData = submission.admin_data as Record<string, any> | null;
    if (!adminData) return null;
    
    // Nur anzeigen wenn tatsächlich vom Admin ergänzte Daten vorhanden sind
    // System-Felder ignorieren (current_step_index, last_section, etc.)
    const systemFields = [
      'current_step_index', 
      'last_section', 
      'restart_from_step',
      'postal_documents_completed',
      'postal_documents_completed_at',
      'quality_check',
      'sms_forwarded',
      'sms_forwarded_at',
      'anosim_response'
    ];
    
    const hasRealAdminData = Object.keys(adminData).some(
      key => !systemFields.includes(key) && adminData[key] !== null && adminData[key] !== undefined
    );
    
    if (hasRealAdminData) {
      return <Badge className="bg-purple-500/80 text-white ml-2">Daten ergänzt</Badge>;
    }
    return null;
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = employees[employeeId];
    if (!employee) return "Unbekannt";
    return employee.first_name && employee.last_name
      ? `${employee.first_name} ${employee.last_name}`
      : employee.email;
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">KYC Anfragen</h1>
        <p className="text-muted-foreground">
          Bearbeiten Sie KYC-Anfragen von Mitarbeitern. Daten können jederzeit ergänzt oder geändert werden.
        </p>
      </div>

      <div className="space-y-4">
        {submissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Video className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Keine Anfragen vorhanden</h3>
              <p className="text-muted-foreground">
                Es wurden noch keine Aufgaben eingereicht
              </p>
            </CardContent>
          </Card>
        ) : (
          submissions.map((submission) => {
            const task = tasks[submission.task_id];
            return (
              <Card key={submission.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <CardTitle className="text-lg">
                          {task?.title || "Unbekannter Auftrag"}
                        </CardTitle>
                        {getStatusBadge(submission.status)}
                        {getDataAddedBadge(submission)}
                      </div>
                      <CardDescription>
                        Eingereicht von: {getEmployeeName(submission.employee_id)} •{" "}
                        {format(new Date(submission.submitted_at), "dd.MM.yyyy HH:mm")}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        console.log('=== LOADING SUBMISSION ===');
                        console.log('Submission:', submission.id);
                        console.log('Admin data:', submission.admin_data);
                        
                        setSelectedSubmission(submission);
                        // Load existing admin_data into state
                        if (submission.admin_data) {
                          const data = submission.admin_data as Record<string, string>;
                          console.log('Processing admin data keys:', Object.keys(data));
                          
                          // If there's an image_url_path, load it as blob
                          if (data.image_url_path) {
                            console.log('Found image path:', data.image_url_path);
                            try {
                              const { data: fileBlob, error } = await supabase.storage
                                .from('kyc-uploads')
                                .download(data.image_url_path);
                              
                              if (!error && fileBlob) {
                                const blobUrl = URL.createObjectURL(fileBlob);
                                console.log('✓ Created blob URL:', blobUrl);
                                data.image_url = blobUrl;
                              } else {
                                console.error('Download error:', error);
                              }
                            } catch (err) {
                              console.error("Error loading image:", err);
                            }
                          } else {
                            console.log('No image_url_path found in admin data');
                          }
                          
                          // If no info field exists, try to load from previous submission of same task
                          if (!data.info) {
                            console.log('No info found, checking previous submissions for same task');
                            const { data: previousSubmissions } = await supabase
                              .from("task_submissions")
                              .select("admin_data")
                              .eq("task_id", submission.task_id)
                              .neq("id", submission.id)
                              .not("admin_data", "is", null)
                              .order("submitted_at", { ascending: false })
                              .limit(1);
                            
                            if (previousSubmissions && previousSubmissions.length > 0) {
                              const prevAdminData = previousSubmissions[0].admin_data as Record<string, any>;
                              if (prevAdminData?.info) {
                                console.log('Found previous info:', prevAdminData.info);
                                data.info = prevAdminData.info;
                                setInfoFromPrevious(true);
                              } else {
                                setInfoFromPrevious(false);
                              }
                            } else {
                              setInfoFromPrevious(false);
                            }
                          } else {
                            setInfoFromPrevious(false);
                          }
                          
                          console.log('Final admin data:', data);
                          setAdminData(data);
                        } else {
                          console.log('No admin data found, checking previous submissions for same task');
                          // Try to load info from previous submission of same task
                          const { data: previousSubmissions } = await supabase
                            .from("task_submissions")
                            .select("admin_data")
                            .eq("task_id", submission.task_id)
                            .neq("id", submission.id)
                            .not("admin_data", "is", null)
                            .order("submitted_at", { ascending: false })
                            .limit(1);
                          
                          if (previousSubmissions && previousSubmissions.length > 0) {
                            const prevAdminData = previousSubmissions[0].admin_data as Record<string, any>;
                            if (prevAdminData?.info) {
                              console.log('Found previous info:', prevAdminData.info);
                              setAdminData({ info: prevAdminData.info });
                              setInfoFromPrevious(true);
                            } else {
                              setAdminData({});
                              setInfoFromPrevious(false);
                            }
                          } else {
                            setAdminData({});
                            setInfoFromPrevious(false);
                          }
                        }
                        console.log('=== LOADING COMPLETE ===');
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Details
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            );
          })
        )}
      </div>

      {/* Review Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => {
        setSelectedSubmission(null);
        setAdminData({});
        setInfoFromPrevious(false);
        setSelectedCustomEmail(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {tasks[selectedSubmission?.task_id || ""]?.title || "Aufgaben-Details"}
            </DialogTitle>
            <DialogDescription>
              Eingereicht von: {selectedSubmission && getEmployeeName(selectedSubmission.employee_id)} •{" "}
              {selectedSubmission && format(new Date(selectedSubmission.submitted_at), "dd.MM.yyyy HH:mm")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Custom E-Mail Anzeige oder Zuweisung */}
            {selectedSubmission && (() => {
              const assignedEmails = getAssignedGeneratedEmails(selectedSubmission.employee_id, selectedSubmission.id);
              const currentEmail = selectedCustomEmail 
                ? assignedEmails.find(e => e.full_address === selectedCustomEmail) 
                : assignedEmails[0];
              
              return (
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      E-Mail-Adresse {assignedEmails.length > 0 ? 'zugewiesen' : 'generieren'}
                    </h4>
                    {currentEmail && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(currentEmail.full_address)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  {assignedEmails.length > 0 ? (
                    <div className="space-y-3">
                      {/* E-Mail Auswahl wenn mehrere vorhanden */}
                      {assignedEmails.length > 1 ? (
                        <Select 
                          value={currentEmail?.full_address || ""} 
                          onValueChange={(value) => setSelectedCustomEmail(value)}
                        >
                          <SelectTrigger className="w-full bg-background">
                            <SelectValue placeholder="E-Mail auswählen..." />
                          </SelectTrigger>
                          <SelectContent>
                            {assignedEmails.map((email) => (
                              <SelectItem key={email.id} value={email.full_address}>
                                {email.full_address}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="bg-background rounded-md p-3 border">
                          <code className="text-sm font-mono">{currentEmail?.full_address}</code>
                        </div>
                      )}
                      
                      {/* Neue E-Mail hinzufügen */}
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Weitere E-Mail hinzufügen:</p>
                        <div className="flex items-center gap-2">
                          <Select onValueChange={generateAndAssignEmail} disabled={generatingEmail}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Domain auswählen..." />
                            </SelectTrigger>
                            <SelectContent>
                              {emailDomains.map((domain) => (
                                <SelectItem key={domain.id} value={domain.id}>
                                  <Plus className="h-3 w-3 inline mr-1" />
                                  @{domain.domain}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {generatingEmail && (
                            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground mb-4">
                        Generieren Sie eine E-Mail-Adresse für diesen Mitarbeiter, um Verifizierungscodes zu empfangen.
                      </p>
                      
                      {emailDomains.length === 0 ? (
                        <p className="text-sm text-destructive">
                          Keine E-Mail-Domains verfügbar. Fügen Sie zunächst eine Domain hinzu.
                        </p>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Select onValueChange={generateAndAssignEmail} disabled={generatingEmail}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Domain auswählen..." />
                            </SelectTrigger>
                            <SelectContent>
                              {emailDomains.map((domain) => (
                                <SelectItem key={domain.id} value={domain.id}>
                                  @{domain.domain}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {generatingEmail && (
                            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

            {/* Zugewiesene Outlook E-Mail-Konten */}
            {selectedSubmission && (() => {
              const outlookEmails = getAssignedOutlookEmails(selectedSubmission.employee_id);
              
              if (outlookEmails.length === 0) return null;
              
              return (
                <div className="bg-secondary/20 p-4 rounded-lg border border-secondary/30">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Mail className="h-4 w-4 text-secondary-foreground" />
                      Outlook E-Mail-Konten ({outlookEmails.length})
                    </h4>
                  </div>
                  
                  <div className="space-y-2">
                    {outlookEmails.map((email) => (
                      <div key={email.id} className="flex items-center justify-between bg-background rounded-md p-3 border">
                        <code className="text-sm font-mono">{email.email_address}</code>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            Outlook
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(email.email_address)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="bg-muted/50 p-4 rounded-lg border">
              <h4 className="font-semibold mb-3">Demo Daten (optional)</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Ergänzen Sie Demo-Zugangsdaten und Identifikationsinformationen für den Mitarbeiter.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="demo-email">Email</Label>
                  <Input
                    id="demo-email"
                    type="email"
                    value={adminData.email || ""}
                    onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                    placeholder="demo@beispiel.de"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="demo-username">Benutzername</Label>
                  <Input
                    id="demo-username"
                    type="text"
                    value={adminData.username || ""}
                    onChange={(e) => setAdminData({ ...adminData, username: e.target.value })}
                    placeholder="Benutzername eingeben..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="demo-password">Passwort</Label>
                  <Input
                    id="demo-password"
                    type="text"
                    value={adminData.password || ""}
                    onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                    placeholder="Passwort eingeben..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="demo-passcode">Passcode</Label>
                  <Input
                    id="demo-passcode"
                    value={adminData.passcode || ""}
                    onChange={(e) => setAdminData({ ...adminData, passcode: e.target.value })}
                    placeholder="Passcode eingeben..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="demo-image">Upload Bild</Label>
                  <div className="border-2 border-dashed rounded-lg p-4">
                    {adminData.image_url ? (
                      <div className="space-y-2">
                        <img 
                          src={adminData.image_url} 
                          alt="Demo Bild" 
                          className="max-h-32 mx-auto rounded"
                        />
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newData = { ...adminData };
                              delete newData.image_url;
                              delete newData.image_url_path;
                              setAdminData(newData);
                            }}
                          >
                            Entfernen
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <Input
                          id="demo-image"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload('image_url', file);
                          }}
                          disabled={uploadingFiles.image_url}
                          className="max-w-xs mx-auto"
                        />
                        {uploadingFiles.image_url && (
                          <p className="text-sm text-muted-foreground mt-2">Wird hochgeladen...</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="demo-phone">Telefonnummer zuweisen</Label>
                  {adminData.phone ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={adminData.phone}
                        disabled
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newData = { ...adminData };
                          delete newData.phone;
                          delete newData.phone_id;
                          setAdminData(newData);
                        }}
                      >
                        Entfernen
                      </Button>
                    </div>
                  ) : (
                    <Select onValueChange={handlePhoneAssignment}>
                      <SelectTrigger>
                        <SelectValue placeholder="Verfügbare Nummer auswählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePhones
                          .filter(p => p.status === 'available' || p.assigned_to === selectedSubmission?.employee_id)
                          .map((phone) => (
                            <SelectItem key={phone.id} value={phone.id}>
                              {phone.phone_number} ({phone.country || 'Unbekannt'})
                              {phone.assigned_to === selectedSubmission?.employee_id && ' - Bereits zugewiesen'}
                            </SelectItem>
                          ))}
                        {availablePhones.filter(p => p.status === 'available' || p.assigned_to === selectedSubmission?.employee_id).length === 0 && (
                          <SelectItem value="none" disabled>
                            Keine verfügbaren Nummern
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ident-code">Ident Code</Label>
                  <Input
                    id="ident-code"
                    value={adminData.ident_code || ""}
                    onChange={(e) => setAdminData({ ...adminData, ident_code: e.target.value })}
                    placeholder="Ident-Code für Verifizierung..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ident-link">Ident Link</Label>
                  <Input
                    id="ident-link"
                    type="url"
                    value={adminData.ident_link || ""}
                    onChange={(e) => setAdminData({ ...adminData, ident_link: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="demo-info">Info / Fragen und Antworten (optional)</Label>
                    {infoFromPrevious && (
                      <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Aus vorheriger Submission
                      </Badge>
                    )}
                  </div>
                  <Textarea
                    id="demo-info"
                    value={adminData.info || ""}
                    onChange={(e) => {
                      setAdminData({ ...adminData, info: e.target.value });
                      setInfoFromPrevious(false); // Remove indicator when user edits
                    }}
                    placeholder="Bitte führen Sie keine tatsächliche Einzahlung ein!"
                    rows={4}
                    className={`resize-none ${infoFromPrevious ? 'border-amber-300 dark:border-amber-700' : ''}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    Diese Informationen werden dem Mitarbeiter bei den Demo-Daten angezeigt.
                  </p>
                </div>


                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={handleSaveDemoData}
                    disabled={savingDemoData}
                  >
                    {savingDemoData ? "Speichert..." : "Demo-Daten speichern"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {selectedSubmission?.status !== "pending" && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium">Status:</span>
                {getStatusBadge(selectedSubmission?.status || "")}
                {selectedSubmission?.reviewed_at && (
                  <span>
                    am {format(new Date(selectedSubmission.reviewed_at), "dd.MM.yyyy HH:mm")}
                  </span>
                )}
              </div>
              {selectedSubmission?.notes && (
                <div className="mt-2">
                  <span className="text-sm font-medium">Notizen:</span>
                  <p className="text-sm text-muted-foreground mt-1">{selectedSubmission.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VideoChat;
