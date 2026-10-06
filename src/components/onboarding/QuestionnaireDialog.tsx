import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Loader2, Plus, Sparkles, Trash2, Trophy, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/lib/toast-stub";
import {
  ACTIVITIES,
  CAREER_GOALS,
  CHANNELS,
  EQUIPMENT,
  EXPERIENCE_LEVELS,
  HOURS,
  INDUSTRIES,
  LANGUAGE_LEVELS,
  SHIFTS,
  TASK_AFFINITIES,
  type ExperienceLevel,
  type QuestionnaireData,
  calculateMatchScore,
  describeMatch,
} from "@/lib/matching";

interface Props {
  open: boolean;
  userId: string;
  onComplete: () => void;
}

const EMPTY: QuestionnaireData = {
  interests: [],
  top_interests: [],
  experience: {},
  preferred_activities: [],
  task_preferences: {},
  languages: [{ language: "Deutsch", level: "Muttersprache" }],
  motivation_text: "",
  interest_topics: "",
  avoid_topics: "",
  equipment: [],
  career_goals: [],
};

const STEPS = [
  "Interessen",
  "Erfahrung",
  "Arbeitsweise",
  "Sprachen",
  "Motivation",
  "Ausstattung",
  "Ziele",
];

export function QuestionnaireDialog({ open, userId, onComplete }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [matches, setMatches] = useState<
    Array<{ id: string; title: string; score: number }>
  >([]);
  const [data, setData] = useState<QuestionnaireData>(EMPTY);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: existing } = await supabase
        .from("employee_questionnaire")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) {
        setData({
          interests: existing.interests ?? [],
          top_interests: existing.top_interests ?? [],
          experience: (existing.experience as any) ?? {},
          preferred_activities: existing.preferred_activities ?? [],
          task_preferences: (existing.task_preferences as any) ?? {},
          languages: (existing.languages as any) ?? EMPTY.languages,
          motivation_text: existing.motivation_text ?? "",
          interest_topics: existing.interest_topics ?? "",
          avoid_topics: existing.avoid_topics ?? "",
          equipment: existing.equipment ?? [],
          career_goals: existing.career_goals ?? [],
        });
      }
    })();
  }, [open, userId]);

  const progress = ((step + 1) / STEPS.length) * 100;

  const toggleArr = (key: keyof QuestionnaireData, value: string) => {
    setData((d) => {
      const arr = (d[key] as string[]) ?? [];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...d, [key]: next } as QuestionnaireData;
    });
  };

  const setTopInterests = (next: string[]) => {
    setData((d) => ({ ...d, top_interests: next.slice(0, 3) }));
  };
  const moveTop = (idx: number, dir: -1 | 1) => {
    setData((d) => {
      const arr = [...d.top_interests];
      const ni = idx + dir;
      if (ni < 0 || ni >= arr.length) return d;
      [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
      return { ...d, top_interests: arr };
    });
  };

  const canNext = useMemo(() => {
    if (step === 0) return data.interests.length >= 1 && data.top_interests.length >= 1;
    return true;
  }, [step, data]);

  async function save(complete: boolean) {
    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        interests: data.interests,
        top_interests: data.top_interests,
        experience: data.experience as any,
        preferred_activities: data.preferred_activities,
        task_preferences: data.task_preferences as any,
        languages: data.languages as any,
        motivation_text: data.motivation_text || null,
        interest_topics: data.interest_topics || null,
        avoid_topics: data.avoid_topics || null,
        equipment: data.equipment,
        career_goals: data.career_goals,
        ...(complete ? { completed_at: new Date().toISOString() } : {}),
      };
      const { error } = await supabase
        .from("employee_questionnaire")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;

      if (complete) {
        await supabase
          .from("profiles")
          .update({ questionnaire_completed: true })
          .eq("id", userId);

        // Match against assigned / available tasks
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title, description, category, tags, assigned_to")
          .or(`assigned_to.eq.${userId},assigned_to.is.null`)
          .limit(200);

        const scored = (tasks ?? [])
          .map((t) => ({
            id: t.id,
            title: t.title,
            score: calculateMatchScore(data, t as any),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        setMatches(scored);
        setDone(true);
      }
    } catch (e: any) {
      toast({
        title: "Fehler beim Speichern",
        description: e?.message ?? "Bitte erneut versuchen.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const next = async () => {
    if (step === STEPS.length - 1) {
      await save(true);
    } else {
      await save(false);
      setStep((s) => s + 1);
    }
  };

  if (done) {
    return (
      <Dialog open={open}>
        <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
          <div className="space-y-5">
            <div className="text-center space-y-2">
              <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Dein persönliches Matching</h2>
              <p className="text-muted-foreground text-sm">{describeMatch(data)}</p>
            </div>

            {matches.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Top-Projekte für dich
                </h3>
                {matches.map((m) => (
                  <Card key={m.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <span className="font-medium text-sm">{m.title}</span>
                      <Badge
                        className={
                          m.score >= 85
                            ? "bg-emerald-500"
                            : m.score >= 70
                            ? "bg-primary"
                            : "bg-muted-foreground"
                        }
                      >
                        {m.score}% Match
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Button className="w-full" onClick={onComplete}>
              Zum Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold">Onboarding-Fragebogen</h2>
              <span className="text-xs text-muted-foreground">
                Schritt {step + 1} / {STEPS.length} · {STEPS[step]}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Dauert ca. 5 Min. Hilft uns, dir die besten Projekte zuzuteilen.
            </p>
          </div>

          {/* STEP 1: Interests */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <Label className="mb-2 block">
                  Für welche Branchen interessierst du dich besonders?
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {INDUSTRIES.map((i) => (
                    <label
                      key={i}
                      className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent"
                    >
                      <Checkbox
                        checked={data.interests.includes(i)}
                        onCheckedChange={() => {
                          toggleArr("interests", i);
                          setData((d) => ({
                            ...d,
                            top_interests: d.top_interests.includes(i)
                              ? d.top_interests
                              : d.interests.includes(i)
                              ? d.top_interests.filter((x) => x !== i)
                              : d.top_interests,
                          }));
                        }}
                      />
                      <span className="text-sm">{i}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">
                  Deine Top-3 (Reihenfolge ändern mit den Pfeilen)
                </Label>
                <div className="space-y-2">
                  {data.interests
                    .filter((i) => !data.top_interests.includes(i))
                    .map((i) => (
                      <Button
                        key={i}
                        size="sm"
                        variant="outline"
                        disabled={data.top_interests.length >= 3}
                        onClick={() => setTopInterests([...data.top_interests, i])}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {i}
                      </Button>
                    ))}
                  {data.interests.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Wähle zuerst Branchen oben aus.
                    </p>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {data.top_interests.map((t, idx) => (
                    <div
                      key={t}
                      className="flex items-center justify-between rounded-md border bg-card p-2"
                    >
                      <div className="flex items-center gap-2">
                        <Badge>{idx + 1}</Badge>
                        <span className="text-sm font-medium">{t}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => moveTop(idx, -1)}
                          disabled={idx === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => moveTop(idx, 1)}
                          disabled={idx === data.top_interests.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setTopInterests(data.top_interests.filter((x) => x !== t))
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Experience */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label className="mb-2 block">
                  In welchen Branchen hast du bereits Erfahrung?
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {[...INDUSTRIES, "Keine Erfahrung"].map((i) => (
                    <label
                      key={i}
                      className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent"
                    >
                      <Checkbox
                        checked={
                          i === "Keine Erfahrung"
                            ? Object.keys(data.experience).length === 0
                            : !!data.experience[i]
                        }
                        onCheckedChange={(v) => {
                          if (i === "Keine Erfahrung") {
                            setData((d) => ({ ...d, experience: {} }));
                          } else {
                            setData((d) => {
                              const next = { ...d.experience };
                              if (v) next[i] = next[i] ?? "Anfänger";
                              else delete next[i];
                              return { ...d, experience: next };
                            });
                          }
                        }}
                      />
                      <span className="text-sm">{i}</span>
                    </label>
                  ))}
                </div>
              </div>

              {Object.keys(data.experience).length > 0 && (
                <div className="space-y-2">
                  <Label>Wie schätzt du dein Wissen ein?</Label>
                  {Object.keys(data.experience).map((br) => (
                    <div key={br} className="flex items-center gap-3">
                      <span className="text-sm w-32">{br}</span>
                      <Select
                        value={data.experience[br]}
                        onValueChange={(v) =>
                          setData((d) => ({
                            ...d,
                            experience: { ...d.experience, [br]: v as ExperienceLevel },
                          }))
                        }
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPERIENCE_LEVELS.map((l) => (
                            <SelectItem key={l} value={l}>
                              {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <Label className="mb-2 block">Welche Tätigkeiten liegen dir besonders?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ACTIVITIES.map((a) => (
                    <label
                      key={a}
                      className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent"
                    >
                      <Checkbox
                        checked={data.preferred_activities.includes(a)}
                        onCheckedChange={() => toggleArr("preferred_activities", a)}
                      />
                      <span className="text-sm">{a}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Working style */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <Label className="mb-2 block">Welche Aufgaben machen dir am meisten Spaß?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {TASK_AFFINITIES.map((a) => {
                    const checked = data.task_preferences.affinities?.includes(a) ?? false;
                    return (
                      <label
                        key={a}
                        className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setData((d) => {
                              const cur = d.task_preferences.affinities ?? [];
                              const next = cur.includes(a)
                                ? cur.filter((x) => x !== a)
                                : [...cur, a];
                              return {
                                ...d,
                                task_preferences: { ...d.task_preferences, affinities: next },
                              };
                            })
                          }
                        />
                        <span className="text-sm">{a}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Wie möchtest du arbeiten?</Label>
                <RadioGroup
                  value={data.task_preferences.channel ?? ""}
                  onValueChange={(v) =>
                    setData((d) => ({
                      ...d,
                      task_preferences: { ...d.task_preferences, channel: v },
                    }))
                  }
                  className="grid grid-cols-2 gap-2"
                >
                  {CHANNELS.map((c) => (
                    <label
                      key={c}
                      className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent"
                    >
                      <RadioGroupItem value={c} />
                      <span className="text-sm">{c}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label className="mb-2 block">Welche Arbeitszeiten bevorzugst du?</Label>
                <RadioGroup
                  value={data.task_preferences.shift ?? ""}
                  onValueChange={(v) =>
                    setData((d) => ({
                      ...d,
                      task_preferences: { ...d.task_preferences, shift: v },
                    }))
                  }
                  className="grid grid-cols-2 gap-2"
                >
                  {SHIFTS.map((s) => (
                    <label
                      key={s}
                      className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent"
                    >
                      <RadioGroupItem value={s} />
                      <span className="text-sm">{s}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label className="mb-2 block">Wie viele Stunden pro Woche?</Label>
                <RadioGroup
                  value={data.task_preferences.hours ?? ""}
                  onValueChange={(v) =>
                    setData((d) => ({
                      ...d,
                      task_preferences: { ...d.task_preferences, hours: v },
                    }))
                  }
                  className="grid grid-cols-2 gap-2"
                >
                  {HOURS.map((h) => (
                    <label
                      key={h}
                      className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent"
                    >
                      <RadioGroupItem value={h} />
                      <span className="text-sm">{h}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}

          {/* STEP 4: Languages */}
          {step === 3 && (
            <div className="space-y-3">
              <Label>Die scanns kommen in Telegramm nicht an wenn man sie aufrufen will</Label>
              {data.languages.map((lang, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="Sprache"
                    value={lang.language}
                    onChange={(e) =>
                      setData((d) => {
                        const next = [...d.languages];
                        next[idx] = { ...next[idx], language: e.target.value };
                        return { ...d, languages: next };
                      })
                    }
                  />
                  <Select
                    value={lang.level}
                    onValueChange={(v) =>
                      setData((d) => {
                        const next = [...d.languages];
                        next[idx] = { ...next[idx], level: v };
                        return { ...d, languages: next };
                      })
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setData((d) => ({
                        ...d,
                        languages: d.languages.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setData((d) => ({
                    ...d,
                    languages: [...d.languages, { language: "", level: "B2" }],
                  }))
                }
              >
                <Plus className="h-4 w-4 mr-1" /> Sprache hinzufügen
              </Button>
            </div>
          )}

          {/* STEP 5: Motivation */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <Label>Warum hast du dich für diese Tätigkeit entschieden?</Label>
                <Textarea
                  value={data.motivation_text ?? ""}
                  onChange={(e) =>
                    setData((d) => ({ ...d, motivation_text: e.target.value }))
                  }
                  rows={3}
                />
              </div>
              <div>
                <Label>Welche Themen interessieren dich besonders?</Label>
                <Textarea
                  value={data.interest_topics ?? ""}
                  onChange={(e) =>
                    setData((d) => ({ ...d, interest_topics: e.target.value }))
                  }
                  rows={3}
                />
              </div>
              <div>
                <Label>Welche Aufgaben möchtest du eher vermeiden?</Label>
                <Textarea
                  value={data.avoid_topics ?? ""}
                  onChange={(e) => setData((d) => ({ ...d, avoid_topics: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* STEP 6: Equipment */}
          {step === 5 && (
            <div>
              <Label className="mb-2 block">Welche technische Ausstattung hast du?</Label>
              <div className="grid grid-cols-1 gap-2">
                {EQUIPMENT.map((e) => (
                  <label
                    key={e}
                    className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent"
                  >
                    <Checkbox
                      checked={data.equipment.includes(e)}
                      onCheckedChange={() => toggleArr("equipment", e)}
                    />
                    <span className="text-sm">{e}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* STEP 7: Goals */}
          {step === 6 && (
            <div>
              <Label className="mb-2 block">
                Wo möchtest du dich langfristig entwickeln?
              </Label>
              <div className="grid grid-cols-1 gap-2">
                {CAREER_GOALS.map((g) => (
                  <label
                    key={g}
                    className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent"
                  >
                    <Checkbox
                      checked={data.career_goals.includes(g)}
                      onCheckedChange={() => toggleArr("career_goals", g)}
                    />
                    <span className="text-sm">{g}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || saving}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Zurück
            </Button>
            <Button onClick={next} disabled={!canNext || saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : step === STEPS.length - 1 ? (
                <Sparkles className="h-4 w-4 mr-1" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-1" />
              )}
              {step === STEPS.length - 1 ? "Auswertung anzeigen" : "Weiter"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
