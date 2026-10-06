import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Phone, MessageSquare, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, History, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface PhoneNumber {
  id: string;
  phone_number: string;
  notes: string | null;
  status: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
  };
}

interface SmsDebugPanelProps {
  phoneNumbers: PhoneNumber[];
}

interface DebugInfo {
  bookingId: string | null;
  phoneNumber: string;
  phoneId: string;
  lastPollTime: Date | null;
  apiStatus: 'idle' | 'polling' | 'success' | 'error';
  lastResponse: any;
  smsCount: number;
  messages: any[];
  assignedTo: string | null;
}

interface SmsForward {
  id: string;
  phone_number: string;
  verification_code: string;
  status: string;
  created_at: string;
  error_message: string | null;
  submission_id: string | null;
}

const SmsDebugPanel = ({ phoneNumbers }: SmsDebugPanelProps) => {
  const [debugInfos, setDebugInfos] = useState<Map<string, DebugInfo>>(new Map());
  const [isPolling, setIsPolling] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshIntervalState] = useState<ReturnType<typeof setInterval> | null>(null);
  const [smsHistory, setSmsHistory] = useState<SmsForward[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Filter phone numbers with booking IDs (active Anosim numbers)
  const activeNumbers = phoneNumbers.filter(pn => {
    const hasBookingId = pn.notes?.includes('Booking ID:');
    return hasBookingId && pn.status === 'assigned';
  });

  const extractBookingId = (notes: string | null): string | null => {
    if (!notes) return null;
    const match = notes.match(/Booking ID: (\d+)/);
    return match ? match[1] : null;
  };

  const pollSmsForNumber = useCallback(async (phoneNumber: PhoneNumber) => {
    const bookingId = extractBookingId(phoneNumber.notes);
    if (!bookingId) return null;

    // Update status to polling
    setDebugInfos(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(phoneNumber.id) || {
        bookingId,
        phoneNumber: phoneNumber.phone_number,
        phoneId: phoneNumber.id,
        lastPollTime: null,
        apiStatus: 'idle' as const,
        lastResponse: null,
        smsCount: 0,
        messages: [],
        assignedTo: phoneNumber.profiles ? 
          `${phoneNumber.profiles.first_name || ''} ${phoneNumber.profiles.last_name || ''}`.trim() : null,
      };
      newMap.set(phoneNumber.id, { ...existing, apiStatus: 'polling' });
      return newMap;
    });

    try {
      console.log(`[SMS Debug] Polling SMS for Booking ID: ${bookingId}, Phone: ${phoneNumber.phone_number}`);
      
      const { data, error } = await supabase.functions.invoke('anosim-api', {
        body: {
          action: 'getSms',
          data: { orderbookingId: parseInt(bookingId) },
        },
      });

      console.log(`[SMS Debug] Response for Booking ${bookingId}:`, data);

      const now = new Date();
      const messages = data?.data || [];
      const smsCount = Array.isArray(messages) ? messages.length : 0;

      setDebugInfos(prev => {
        const newMap = new Map(prev);
        newMap.set(phoneNumber.id, {
          bookingId,
          phoneNumber: phoneNumber.phone_number,
          phoneId: phoneNumber.id,
          lastPollTime: now,
          apiStatus: error ? 'error' : 'success',
          lastResponse: data,
          smsCount,
          messages: Array.isArray(messages) ? messages.slice(-5) : [],
          assignedTo: phoneNumber.profiles ? 
            `${phoneNumber.profiles.first_name || ''} ${phoneNumber.profiles.last_name || ''}`.trim() : null,
        });
        return newMap;
      });

      return { success: !error, smsCount, data };
    } catch (err) {
      console.error(`[SMS Debug] Error polling Booking ${bookingId}:`, err);
      
      setDebugInfos(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(phoneNumber.id);
        if (existing) {
          newMap.set(phoneNumber.id, { ...existing, apiStatus: 'error', lastPollTime: new Date() });
        }
        return newMap;
      });

      return { success: false, error: err };
    }
  }, []);

  const pollAllNumbers = useCallback(async () => {
    if (isPolling || activeNumbers.length === 0) return;
    
    setIsPolling(true);
    console.log(`[SMS Debug] Polling ${activeNumbers.length} active numbers...`);

    try {
      await Promise.all(activeNumbers.map(pn => pollSmsForNumber(pn)));
    } finally {
      setIsPolling(false);
    }
  }, [activeNumbers, isPolling, pollSmsForNumber]);

  // Fetch SMS history from database
  const fetchSmsHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('sms_forwards')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setSmsHistory(data);
      }
    } catch (err) {
      console.error('[SMS Debug] Error fetching SMS history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && activeNumbers.length > 0) {
      const interval = setInterval(() => {
        pollAllNumbers();
        fetchSmsHistory();
      }, 5000); // Poll every 5 seconds
      setRefreshIntervalState(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshIntervalState(null);
    }
  }, [autoRefresh, activeNumbers.length, pollAllNumbers, fetchSmsHistory]);

  // Initial poll on mount
  useEffect(() => {
    fetchSmsHistory();
    if (activeNumbers.length > 0) {
      pollAllNumbers();
    }
  }, [activeNumbers.length, fetchSmsHistory]);

  const getStatusIcon = (status: DebugInfo['apiStatus']) => {
    switch (status) {
      case 'polling':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatTime = (date: Date | null) => {
    if (!date) return '-';
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Render SMS History Tab Content
  const renderSmsHistory = () => (
    <ScrollArea className="h-[400px]">
      {loadingHistory ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : smsHistory.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Inbox className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Keine SMS-Weiterleitungen in der Datenbank</p>
        </div>
      ) : (
        <div className="space-y-2">
          {smsHistory.map((sms) => (
            <div
              key={sms.id}
              className="border rounded-lg p-3 bg-muted/30"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <span className="font-mono text-sm font-medium">{sms.phone_number}</span>
                </div>
                <Badge 
                  variant={sms.status === 'forwarded' ? 'default' : sms.status === 'error' ? 'destructive' : 'secondary'}
                >
                  {sms.status}
                </Badge>
              </div>
              
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Code:</span>
                  <span className="font-mono font-bold text-lg text-primary">{sms.verification_code}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {format(new Date(sms.created_at), "dd.MM.yyyy HH:mm:ss", { locale: de })}
                  </span>
                </div>
                {sms.submission_id && (
                  <div>
                    <span className="text-muted-foreground">Submission:</span>
                    <span className="ml-2 font-mono text-xs">{sms.submission_id.slice(0, 8)}...</span>
                  </div>
                )}
                {sms.error_message && (
                  <div className="text-destructive">
                    <span>Fehler:</span>
                    <span className="ml-2">{sms.error_message}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );

  // Render Active Numbers Tab Content
  const renderActiveNumbers = () => (
    <ScrollArea className="h-[400px]">
      {activeNumbers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Phone className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Keine aktiven Anosim-Nummern mit Booking ID</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeNumbers.map((pn) => {
            const info = debugInfos.get(pn.id);
            const bookingId = extractBookingId(pn.notes);

            return (
              <div
                key={pn.id}
                className="border rounded-lg p-3 bg-muted/30"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    <span className="font-mono text-sm font-medium">{pn.phone_number}</span>
                    {info && getStatusIcon(info.apiStatus)}
                  </div>
                  <Badge variant={info?.smsCount ? "default" : "secondary"}>
                    {info?.smsCount ?? 0} SMS
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Booking ID:</span>
                    <span className="ml-2 font-mono font-medium">{bookingId || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Zugewiesen:</span>
                    <span className="ml-2">
                      {pn.profiles?.first_name && pn.profiles?.last_name
                        ? `${pn.profiles.first_name} ${pn.profiles.last_name}`
                        : '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Letzter Poll:</span>
                    <span className="ml-1">{formatTime(info?.lastPollTime ?? null)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">API Status:</span>
                    <span className={`ml-2 ${
                      info?.apiStatus === 'success' ? 'text-success' :
                      info?.apiStatus === 'error' ? 'text-destructive' :
                      info?.apiStatus === 'polling' ? 'text-primary' :
                      'text-muted-foreground'
                    }`}>
                      {info?.apiStatus === 'success' ? '✓ Verbunden' :
                       info?.apiStatus === 'error' ? '✗ Fehler' :
                       info?.apiStatus === 'polling' ? '⟳ Polling...' :
                       '○ Idle'}
                    </span>
                  </div>
                </div>

                {/* Last API Response */}
                {info?.lastResponse && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="text-xs text-muted-foreground mb-1">Letzte API-Response:</div>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-24 font-mono">
                      {JSON.stringify(info.lastResponse, null, 2)}
                    </pre>
                  </div>
                )}

                {/* SMS Messages */}
                {info?.messages && info.messages.length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="text-xs text-muted-foreground mb-1">Letzte SMS:</div>
                    <div className="space-y-1">
                      {info.messages.map((msg: any, idx: number) => (
                        <div key={idx} className="text-xs bg-muted p-2 rounded">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Von: {msg.sender || 'Unbekannt'}</span>
                            <span>{msg.receivedAt ? new Date(msg.receivedAt).toLocaleString('de-DE') : '-'}</span>
                          </div>
                          <div className="mt-1 font-medium">{msg.text || msg.message || '-'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ScrollArea>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS Debug Panel
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="text-xs"
            >
              {autoRefresh ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Auto-Refresh AN
                </>
              ) : (
                'Auto-Refresh'
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                pollAllNumbers();
                fetchSmsHistory();
              }}
              disabled={isPolling || loadingHistory}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isPolling || loadingHistory ? 'animate-spin' : ''}`} />
              Aktualisieren
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="history" className="text-xs">
              <History className="h-3 w-3 mr-1" />
              SMS-History ({smsHistory.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs">
              <Phone className="h-3 w-3 mr-1" />
              Aktive Nummern ({activeNumbers.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="history">
            {renderSmsHistory()}
          </TabsContent>
          
          <TabsContent value="active">
            {renderActiveNumbers()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SmsDebugPanel;
