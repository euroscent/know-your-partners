import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow, format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Shield, ShieldAlert, ShieldCheck, ShieldX,
  Activity, Search, RefreshCw, CheckCircle2,
  AlertTriangle, XCircle, Globe, Monitor,
  Clock, Users, TrendingUp, Eye, Skull
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  user_id: string | null;
  email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  country: string | null;
  city: string | null;
  device_fingerprint: string | null;
  metadata: any;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  notes: string | null;
  created_at: string;
}

interface SecurityStats {
  total_events: number;
  critical_events: number;
  warning_events: number;
  login_failures: number;
  login_successes: number;
  unique_ips: number;
  unique_users: number;
  unresolved: number;
}

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  login_success: { label: "Login erfolgreich", icon: "✅", color: "text-green-500" },
  login_failure: { label: "Login fehlgeschlagen", icon: "❌", color: "text-red-500" },
  password_reset: { label: "Passwort zurückgesetzt", icon: "🔑", color: "text-yellow-500" },
  signup: { label: "Registrierung", icon: "📝", color: "text-blue-500" },
  admin_action: { label: "Admin-Aktion", icon: "⚙️", color: "text-purple-500" },
  suspicious_activity: { label: "Verdächtige Aktivität", icon: "🚨", color: "text-red-600" },
  brute_force: { label: "Brute-Force erkannt", icon: "🛑", color: "text-red-700" },
  new_device: { label: "Neues Gerät", icon: "📱", color: "text-orange-500" },
  new_ip: { label: "Neue IP-Adresse", icon: "🌐", color: "text-orange-500" },
  session_created: { label: "Session erstellt", icon: "🔐", color: "text-green-400" },
  logout: { label: "Abgemeldet", icon: "🚪", color: "text-muted-foreground" },
  admin_login: { label: "Admin Login", icon: "👑", color: "text-amber-500" },
  profile_update: { label: "Profil geändert", icon: "👤", color: "text-blue-400" },
  settings_change: { label: "Einstellung geändert", icon: "⚙️", color: "text-purple-400" },
  data_export: { label: "Daten-Export", icon: "📤", color: "text-amber-600" },
  file_upload: { label: "Datei-Upload", icon: "📁", color: "text-blue-400" },
  file_download: { label: "Datei-Download", icon: "📥", color: "text-blue-300" },
  permission_change: { label: "Berechtigung geändert", icon: "🔐", color: "text-red-600" },
  password_change: { label: "Passwort geändert", icon: "🔑", color: "text-amber-500" },
  account_lockout: { label: "Konto gesperrt", icon: "🔒", color: "text-red-700" },
  mfa_attempt: { label: "MFA-Versuch", icon: "📲", color: "text-blue-500" },
};

const SEVERITY_CONFIG = {
  info: { label: "Info", variant: "secondary" as const, icon: Eye },
  warning: { label: "Warnung", variant: "outline" as const, icon: AlertTriangle },
  critical: { label: "Kritisch", variant: "destructive" as const, icon: XCircle },
};

function isAttackerEvent(event: SecurityEvent): boolean {
  if (event.metadata?.is_attacker) return true;
  if (event.event_type === "brute_force") return true;
  if (event.event_type === "suspicious_activity") return true;
  if (event.severity === "critical" && event.event_type === "login_failure") return true;
  return false;
}

function isSuspiciousEvent(event: SecurityEvent): boolean {
  if (event.metadata?.new_ip || event.metadata?.new_device) return true;
  if (event.severity === "warning") return true;
  return false;
}

const SecurityMonitoring = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState("24");

  const loadData = useCallback(async () => {
    setLoading(true);
    const hours = parseInt(timeRange);

    let query = supabase
      .from("security_events" as any)
      .select("*")
      .gte("created_at", new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(200);

    if (filterType !== "all") query = query.eq("event_type", filterType);
    if (filterSeverity !== "all") query = query.eq("severity", filterSeverity);

    const { data: eventsData } = await query;
    setEvents((eventsData as any) || []);

    const { data: statsData } = await supabase.rpc("get_security_stats" as any, { _hours: hours });
    setStats(statsData as any);

    setLoading(false);
  }, [timeRange, filterType, filterSeverity]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/auth"); return; }
      supabase.from("user_roles").select("role").eq("user_id", session.user.id).then(({ data: roles }) => {
        if (!roles?.some(r => r.role === "admin")) navigate("/dashboard");
      });
    });
    loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel("security-events-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "security_events" }, () => {
        loadData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(e =>
      (e.email?.toLowerCase().includes(q)) ||
      (e.ip_address?.toLowerCase().includes(q)) ||
      (e.event_type.toLowerCase().includes(q)) ||
      (e.country?.toLowerCase().includes(q)) ||
      (e.city?.toLowerCase().includes(q))
    );
  }, [events, searchQuery]);

  const attackerCount = useMemo(() => filteredEvents.filter(isAttackerEvent).length, [filteredEvents]);

  const resolveEvent = async (eventId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    await (supabase.from("security_events" as any) as any).update({
      resolved: true,
      resolved_by: session?.user.id,
      resolved_at: new Date().toISOString(),
    }).eq("id", eventId);
    loadData();
  };

  const threatLevel = useMemo(() => {
    if (!stats) return "low";
    if (stats.critical_events > 0) return "critical";
    if (stats.warning_events > 3 || stats.login_failures > 10) return "high";
    if (stats.warning_events > 0 || stats.login_failures > 5) return "medium";
    return "low";
  }, [stats]);

  const threatConfig = {
    low: { label: "Niedrig", color: "bg-green-500", textColor: "text-green-500", icon: ShieldCheck },
    medium: { label: "Mittel", color: "bg-yellow-500", textColor: "text-yellow-500", icon: Shield },
    high: { label: "Hoch", color: "bg-orange-500", textColor: "text-orange-500", icon: ShieldAlert },
    critical: { label: "Kritisch", color: "bg-red-500", textColor: "text-red-500", icon: ShieldX },
  };

  const ThreatIcon = threatConfig[threatLevel].icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ThreatIcon className={`h-8 w-8 ${threatConfig[threatLevel].textColor}`} />
          <div>
            <h1 className="text-2xl font-bold">Security Monitoring</h1>
            <p className="text-sm text-muted-foreground">
              Bedrohungslevel: <span className={`font-semibold ${threatConfig[threatLevel].textColor}`}>
                {threatConfig[threatLevel].label}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <Clock className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Letzte Stunde</SelectItem>
              <SelectItem value="6">Letzte 6h</SelectItem>
              <SelectItem value="24">Letzte 24h</SelectItem>
              <SelectItem value="168">Letzte 7 Tage</SelectItem>
              <SelectItem value="720">Letzte 30 Tage</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadData}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Gesamte Events</p>
                  <p className="text-2xl font-bold">{stats.total_events}</p>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card className={stats.critical_events > 0 ? "border-destructive bg-destructive/5" : ""}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Kritische Events</p>
                  <p className="text-2xl font-bold text-destructive">{stats.critical_events}</p>
                </div>
                <XCircle className="h-8 w-8 text-destructive/30" />
              </div>
            </CardContent>
          </Card>
          <Card className={attackerCount > 0 ? "border-red-600 bg-red-500/10" : ""}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Angreifer erkannt</p>
                  <p className="text-2xl font-bold text-red-600">{attackerCount}</p>
                </div>
                <Skull className="h-8 w-8 text-red-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Ungelöst</p>
                  <p className="text-2xl font-bold text-amber-500">{stats.unresolved}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-3 pb-3 flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Unique IPs</p>
                <p className="text-lg font-semibold">{stats.unique_ips}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3 flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Unique Users</p>
                <p className="text-lg font-semibold">{stats.unique_users}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Erfolgreiche Logins</p>
                <p className="text-lg font-semibold">{stats.login_successes}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach E-Mail, IP, Land..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Event-Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="login_success">Login erfolgreich</SelectItem>
            <SelectItem value="login_failure">Login fehlgeschlagen</SelectItem>
            <SelectItem value="brute_force">Brute-Force</SelectItem>
            <SelectItem value="suspicious_activity">Verdächtig</SelectItem>
            <SelectItem value="password_reset">Passwort-Reset</SelectItem>
            <SelectItem value="signup">Registrierung</SelectItem>
            <SelectItem value="admin_action">Admin-Aktion</SelectItem>
            <SelectItem value="admin_login">Admin Login</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Levels</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warnung</SelectItem>
            <SelectItem value="critical">Kritisch</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">
            <Activity className="h-4 w-4 mr-1" /> Timeline ({filteredEvents.length})
          </TabsTrigger>
          <TabsTrigger value="attackers" className={attackerCount > 0 ? "text-red-600" : ""}>
            <Skull className="h-4 w-4 mr-1" /> Angreifer ({attackerCount})
          </TabsTrigger>
          <TabsTrigger value="critical">
            <XCircle className="h-4 w-4 mr-1" /> Kritisch ({filteredEvents.filter(e => e.severity === "critical").length})
          </TabsTrigger>
          <TabsTrigger value="unresolved">
            <AlertTriangle className="h-4 w-4 mr-1" /> Ungelöst ({filteredEvents.filter(e => !e.resolved && e.severity !== "info").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <EventList events={filteredEvents} onResolve={resolveEvent} />
        </TabsContent>
        <TabsContent value="attackers">
          <EventList events={filteredEvents.filter(isAttackerEvent)} onResolve={resolveEvent} />
        </TabsContent>
        <TabsContent value="critical">
          <EventList events={filteredEvents.filter(e => e.severity === "critical")} onResolve={resolveEvent} />
        </TabsContent>
        <TabsContent value="unresolved">
          <EventList events={filteredEvents.filter(e => !e.resolved && e.severity !== "info")} onResolve={resolveEvent} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const EventList = ({ events, onResolve }: { events: SecurityEvent[]; onResolve: (id: string) => void }) => (
  <Card>
    <CardContent className="p-0">
      <ScrollArea className="h-[500px]">
        <div className="divide-y">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mb-3 text-green-500/50" />
              <p className="font-medium">Keine Events in diesem Zeitraum</p>
              <p className="text-sm">Alles sicher! ✨</p>
            </div>
          ) : (
            events.map((event) => {
              const config = EVENT_TYPE_CONFIG[event.event_type] || { label: event.event_type, icon: "📋", color: "text-muted-foreground" };
              const sevConfig = SEVERITY_CONFIG[event.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.info;
              const attacker = isAttackerEvent(event);
              const suspicious = isSuspiciousEvent(event);

              let rowClass = "p-4 hover:bg-muted/50 transition-colors";
              if (attacker) {
                rowClass += " bg-red-500/10 border-l-4 border-l-red-600 dark:bg-red-950/40";
              } else if (event.severity === "critical") {
                rowClass += " bg-destructive/5 border-l-4 border-l-destructive";
              } else if (suspicious) {
                rowClass += " bg-amber-500/5 border-l-4 border-l-amber-500";
              }

              return (
                <div key={event.id} className={rowClass}>
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{attacker ? "💀" : config.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`font-medium text-sm ${attacker ? "text-red-600 font-bold" : config.color}`}>
                          {config.label}
                        </span>
                        <Badge variant={sevConfig.variant} className="text-xs">
                          {sevConfig.label}
                        </Badge>
                        {attacker && (
                          <Badge className="text-xs bg-red-600 text-white border-red-700 animate-pulse">
                            <Skull className="h-3 w-3 mr-1" /> ANGREIFER
                          </Badge>
                        )}
                        {event.resolved && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Gelöst
                          </Badge>
                        )}
                        {event.metadata?.new_ip && (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                            🌐 Neue IP
                          </Badge>
                        )}
                        {event.metadata?.new_device && (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                            📱 Neues Gerät
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {event.email && (
                          <span className={attacker ? "text-red-500 font-semibold" : ""}>
                            📧 {event.email}
                          </span>
                        )}
                        {event.ip_address && event.ip_address !== "unknown" && (
                          <span className={attacker ? "text-red-500 font-semibold font-mono" : ""}>
                            🌐 {event.ip_address}
                          </span>
                        )}
                        {(event.country || event.city) && (
                          <span>📍 {[event.city, event.country].filter(Boolean).join(", ")}</span>
                        )}
                        {event.user_agent && event.user_agent !== "unknown" && (
                          <span className="truncate" title={event.user_agent}>
                            <Monitor className="h-3 w-3 inline mr-1" />
                            {event.user_agent.substring(0, 60)}...
                          </span>
                        )}
                      </div>

                      {event.metadata?.error && (
                        <p className="text-xs text-destructive mt-1 font-mono bg-destructive/10 px-2 py-1 rounded">
                          {String(event.metadata.error).substring(0, 200)}
                        </p>
                      )}

                      {attacker && event.metadata?.detected_pattern && (
                        <p className="text-xs text-red-600 mt-1 font-semibold bg-red-500/10 px-2 py-1 rounded">
                          🚨 Pattern: {event.metadata.detected_pattern}
                        </p>
                      )}

                      <p className="text-xs text-muted-foreground mt-1.5">
                        {format(new Date(event.created_at), "dd.MM.yyyy HH:mm:ss", { locale: de })}
                        {" · "}
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: de })}
                      </p>
                    </div>

                    {!event.resolved && event.severity !== "info" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onResolve(event.id)}
                        className="text-xs shrink-0"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Lösen
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </CardContent>
  </Card>
);

export default SecurityMonitoring;
