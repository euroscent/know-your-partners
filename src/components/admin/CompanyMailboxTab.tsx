import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, MailOpen, Loader2, RefreshCw, Inbox } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { wrapEmailHtmlForPreview } from "@/lib/emailPreview";

type CompanyEmail = {
  id: string;
  to_address: string;
  from_address: string;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  is_read: boolean;
  received_at: string;
};

interface CompanyMailboxTabProps {
  mainEmail: string;
  supportEmail: string;
}

export const CompanyMailboxTab = ({ mainEmail, supportEmail }: CompanyMailboxTabProps) => {
  const addresses = useMemo(() => {
    const list: { key: string; label: string; address: string }[] = [];
    if (mainEmail) list.push({ key: "main", label: "Haupt-E-Mail", address: mainEmail });
    if (supportEmail && supportEmail.toLowerCase() !== mainEmail.toLowerCase()) {
      list.push({ key: "support", label: "Support-E-Mail", address: supportEmail });
    }
    return list;
  }, [mainEmail, supportEmail]);

  const [activeKey, setActiveKey] = useState(addresses[0]?.key ?? "main");
  const [emails, setEmails] = useState<CompanyEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CompanyEmail | null>(null);

  const activeAddress = addresses.find(a => a.key === activeKey)?.address ?? "";

  useEffect(() => {
    if (!addresses.some(a => a.key === activeKey) && addresses[0]) {
      setActiveKey(addresses[0].key);
    }
  }, [addresses, activeKey]);

  const fetchEmails = async (address: string) => {
    if (!address) {
      setEmails([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("received_emails")
      .select("id, to_address, from_address, subject, body_html, body_text, is_read, received_at")
      .ilike("to_address", `%${address}%`)
      .order("received_at", { ascending: false })
      .limit(100);

    if (error) console.error("Error loading company emails:", error);
    setEmails((data as CompanyEmail[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchEmails(activeAddress);

    if (!activeAddress) return;
    const channel = supabase
      .channel(`company-mailbox-${activeAddress}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "received_emails" }, () => {
        fetchEmails(activeAddress);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeAddress]);

  const openEmail = async (email: CompanyEmail) => {
    setSelected(email);
    if (!email.is_read) {
      await supabase.from("received_emails").update({ is_read: true }).eq("id", email.id);
      setEmails(prev => prev.map(e => (e.id === email.id ? { ...e, is_read: true } : e)));
    }
  };

  if (addresses.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <Mail className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p>Keine Haupt- oder Support-E-Mail in den Einstellungen hinterlegt.</p>
      </Card>
    );
  }

  const unread = emails.filter(e => !e.is_read).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Tabs value={activeKey} onValueChange={setActiveKey}>
          <TabsList>
            {addresses.map(a => (
              <TabsTrigger key={a.key} value={a.key} className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {a.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{activeAddress}</Badge>
          {unread > 0 && <Badge>{unread} neu</Badge>}
          <Button variant="outline" size="sm" onClick={() => fetchEmails(activeAddress)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <ScrollArea className="h-[calc(100vh-380px)]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Keine E-Mails für {activeAddress}</p>
            </div>
          ) : (
            <div className="divide-y">
              {emails.map(email => (
                <button
                  key={email.id}
                  onClick={() => openEmail(email)}
                  className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors ${
                    !email.is_read ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {email.is_read ? (
                      <MailOpen className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                    ) : (
                      <Mail className="h-4 w-4 mt-1 text-primary shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate ${!email.is_read ? "font-semibold" : "font-medium"}`}>
                          {email.subject || "Kein Betreff"}
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(email.received_at), "dd.MM.yyyy HH:mm", { locale: de })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">Von: {email.from_address}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selected?.subject || "Kein Betreff"}</DialogTitle>
            <DialogDescription>
              Von: {selected?.from_address} • An: {selected?.to_address}
              {selected?.received_at &&
                ` • ${format(new Date(selected.received_at), "dd. MMMM yyyy, HH:mm", { locale: de })}`}
            </DialogDescription>
          </DialogHeader>
          {selected?.body_html ? (
            <iframe
              srcDoc={wrapEmailHtmlForPreview(selected.body_html, "https://epp-dashboard.net")}
              className="w-full border-0 rounded-lg bg-white"
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
              referrerPolicy="no-referrer"
              style={{ height: "480px" }}
            />
          ) : (
            <div className="whitespace-pre-wrap text-sm max-h-[480px] overflow-auto">
              {selected?.body_text || "Kein Inhalt"}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
