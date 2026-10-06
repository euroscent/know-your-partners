import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Mail, Inbox, MailOpen, Circle, Pencil, Trash2, Check, X, Users, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/lib/toast-stub";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Documents from "@/pages/Documents";
import { CompanyMailboxTab } from "@/components/admin/CompanyMailboxTab";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type ChatMessage = {
  id: string;
  user_id: string;
  message: string;
  role: "user" | "assistant" | "admin";
  is_read: boolean;
  created_at: string;
  virtual_employee_id?: string | null;
  subject?: string | null;
};

type VirtualEmployee = {
  id: string;
  first_name: string;
  last_name: string;
};

type EmployeeConversation = {
  user_id: string;
  user_name: string;
  user_email: string;
  last_message: string;
  last_message_time: string;
  total_unread: number;
  virtual_employees_contacted: string[]; // IDs of virtual employees they messaged
};

const ChatInbox = () => {
  const [conversations, setConversations] = useState<EmployeeConversation[]>([]);
  const [virtualEmployees, setVirtualEmployees] = useState<VirtualEmployee[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedVirtualEmployeeId, setSelectedVirtualEmployeeId] = useState<string>("all");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyInput, setReplyInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const [contact, setContact] = useState({ main_email: "", support_email: "" });
  const [contactLoaded, setContactLoaded] = useState(false);

  useEffect(() => {
    const loadContact = async () => {
      const { data } = await supabase
        .from("company_contact")
        .select("main_email, support_email")
        .maybeSingle();
      setContact({
        main_email: data?.main_email || "",
        support_email: data?.support_email || "",
      });
      setContactLoaded(true);
    };
    loadContact();
  }, []);


  const selectedConversation = conversations.find(c => c.user_id === selectedUserId);
  const selectedVirtualEmployee = virtualEmployees.find(v => v.id === selectedVirtualEmployeeId);

  // Update admin presence
  const updatePresence = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("admin_presence")
      .upsert({
        admin_id: user.id,
        last_seen_at: new Date().toISOString(),
        is_online: true,
      }, { onConflict: 'admin_id' });
  };

  // Set admin as offline when leaving
  const setOffline = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("admin_presence")
      .upsert({
        admin_id: user.id,
        last_seen_at: new Date().toISOString(),
        is_online: false,
      }, { onConflict: 'admin_id' });
  };

  useEffect(() => {
    checkAuth();
    loadVirtualEmployees();
    loadConversations();
    
    // Update presence immediately and every 30 seconds
    updatePresence();
    const presenceInterval = setInterval(updatePresence, 30000);
    
    // Check for URL parameter to auto-select user
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user');
    if (userId) {
      setSelectedUserId(userId);
    }

    // Subscribe to realtime updates
    const channel = supabase
      .channel('chat-inbox-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
        },
        () => {
          loadConversations();
          if (selectedUserId) loadMessages(selectedUserId, selectedVirtualEmployeeId);
        }
      )
      .subscribe();

    // Handle page visibility and unload
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setOffline();
      } else {
        updatePresence();
      }
    };

    const handleBeforeUnload = () => {
      setOffline();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(presenceInterval);
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setOffline();
    };
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadMessages(selectedUserId, selectedVirtualEmployeeId);
      markAsRead(selectedUserId, selectedVirtualEmployeeId);
    }
  }, [selectedUserId, selectedVirtualEmployeeId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) {
      toast({
        title: "Zugriff verweigert",
        description: "Sie haben keine Berechtigung für diese Seite",
        variant: "destructive",
      });
      navigate("/dashboard");
    }
  };

  const loadVirtualEmployees = async () => {
    const { data, error } = await supabase
      .from("virtual_employees")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .order("last_name");

    if (error) {
      console.error("Error loading virtual employees:", error);
      return;
    }

    setVirtualEmployees(data || []);
  };

  const loadConversations = async () => {
    // Load ALL chat messages
    const { data: allMessages, error: messagesError } = await supabase
      .from("chat_messages")
      .select("id, user_id, message, created_at, is_read, role, virtual_employee_id")
      .order("created_at", { ascending: false });

    if (messagesError) {
      console.error("Error loading messages:", messagesError);
      return;
    }

    // Get unique user IDs
    const userIds = [...new Set(allMessages?.map(m => m.user_id) || [])];
    
    // Load user profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", userIds);

    // Group messages by user_id only
    const userMap = new Map<string, {
      messages: any[],
      virtual_employees_contacted: Set<string>
    }>();

    allMessages?.forEach((msg: any) => {
      if (!userMap.has(msg.user_id)) {
        userMap.set(msg.user_id, {
          messages: [],
          virtual_employees_contacted: new Set()
        });
      }
      const userData = userMap.get(msg.user_id)!;
      userData.messages.push(msg);
      if (msg.virtual_employee_id) {
        userData.virtual_employees_contacted.add(msg.virtual_employee_id);
      }
    });

    // Build conversation list
    const convList: EmployeeConversation[] = [];

    userMap.forEach((data, usrId) => {
      const profile = profiles?.find((p: any) => p.id === usrId);
      
      const userName = profile 
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email 
        : 'Unbekannter Benutzer';

      const sortedMsgs = data.messages.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      const lastMsg = sortedMsgs[0];
      const totalUnread = data.messages.filter((m: any) => !m.is_read && m.role === 'user').length;

      convList.push({
        user_id: usrId,
        user_name: userName,
        user_email: profile?.email || '',
        last_message: lastMsg?.message || '',
        last_message_time: lastMsg?.created_at || new Date().toISOString(),
        total_unread: totalUnread,
        virtual_employees_contacted: Array.from(data.virtual_employees_contacted),
      });
    });

    // Sort: unread first, then by last message time
    convList.sort((a, b) => {
      if (a.total_unread > 0 && b.total_unread === 0) return -1;
      if (b.total_unread > 0 && a.total_unread === 0) return 1;
      return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
    });

    setConversations(convList);
  };

  const loadMessages = async (userId: string, virtualEmployeeFilter: string) => {
    let query = supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (virtualEmployeeFilter === "hr") {
      query = query.is("virtual_employee_id", null);
    } else if (virtualEmployeeFilter !== "all") {
      query = query.eq("virtual_employee_id", virtualEmployeeFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading messages:", error);
      return;
    }

    setMessages((data || []) as ChatMessage[]);
  };

  const markAsRead = async (userId: string, virtualEmployeeFilter: string) => {
    let query = supabase
      .from("chat_messages")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (virtualEmployeeFilter === "hr") {
      query = query.is("virtual_employee_id", null);
    } else if (virtualEmployeeFilter !== "all") {
      query = query.eq("virtual_employee_id", virtualEmployeeFilter);
    }

    await query;
    loadConversations();
  };

  const handleSendReply = async () => {
    if (!replyInput.trim() || !selectedUserId || isLoading) return;
    
    // Must select a specific virtual employee to reply as
    if (selectedVirtualEmployeeId === "all") {
      toast({
        title: "Kontakt auswählen",
        description: "Bitte wählen Sie einen Kontakt aus, als den Sie antworten möchten",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from("chat_messages").insert({
        user_id: selectedUserId,
        message: replyInput.trim(),
        role: "admin",
        is_read: false,
        virtual_employee_id: selectedVirtualEmployeeId === "hr" ? null : selectedVirtualEmployeeId,
      });

      if (error) throw error;

      setReplyInput("");
      await loadMessages(selectedUserId, selectedVirtualEmployeeId);
      await loadConversations();

      toast({
        title: "Antwort gesendet",
        description: "Ihre Nachricht wurde erfolgreich gesendet",
      });
    } catch (error) {
      console.error("Error sending reply:", error);
      toast({
        title: "Fehler",
        description: "Nachricht konnte nicht gesendet werden",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditMessage = (messageId: string, currentText: string) => {
    setEditingMessageId(messageId);
    setEditingText(currentText);
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editingText.trim()) return;

    try {
      const { error } = await supabase
        .from("chat_messages")
        .update({ message: editingText.trim() })
        .eq("id", messageId);

      if (error) throw error;

      setEditingMessageId(null);
      setEditingText("");
      if (selectedUserId) await loadMessages(selectedUserId, selectedVirtualEmployeeId);
      await loadConversations();

      toast({
        title: "Nachricht aktualisiert",
        description: "Die Nachricht wurde erfolgreich bearbeitet",
      });
    } catch (error) {
      console.error("Error updating message:", error);
      toast({
        title: "Fehler",
        description: "Nachricht konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Möchten Sie diese Nachricht wirklich löschen?")) return;

    try {
      const { error } = await supabase
        .from("chat_messages")
        .delete()
        .eq("id", messageId);

      if (error) throw error;

      if (selectedUserId) await loadMessages(selectedUserId, selectedVirtualEmployeeId);
      await loadConversations();

      toast({
        title: "Nachricht gelöscht",
        description: "Die Nachricht wurde erfolgreich entfernt",
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      toast({
        title: "Fehler",
        description: "Nachricht konnte nicht gelöscht werden",
        variant: "destructive",
      });
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  };

  const getVirtualEmployeeName = (id: string | null | undefined) => {
    if (!id) return "HR-Assistent";
    const ve = virtualEmployees.find(v => v.id === id);
    return ve ? `${ve.first_name} ${ve.last_name}` : "Unbekannt";
  };

  const getReplyAsName = () => {
    if (selectedVirtualEmployeeId === "all") return null;
    if (selectedVirtualEmployeeId === "hr") return "HR-Team";
    return getVirtualEmployeeName(selectedVirtualEmployeeId);
  };

  const companyLabel = contact.main_email || contact.support_email || "Firmen-Postfach";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <Inbox className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Posteingang</h1>
          <p className="text-muted-foreground mt-1">
            Chat & Postfach
          </p>
        </div>
      </div>

      {contactLoaded && (
      <Tabs defaultValue={contact.main_email ? "company" : "chat"} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Chat Postfach
            {conversations.filter(c => c.total_unread > 0).length > 0 && (
              <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center ml-1">
                {conversations.filter(c => c.total_unread > 0).length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {companyLabel}
          </TabsTrigger>
          <TabsTrigger value="postfach" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Mein Postfach
          </TabsTrigger>
        </TabsList>


        <TabsContent value="chat">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-280px)]">
        {/* Employee List */}
        <Card className="md:col-span-1 overflow-hidden">
          <div className="bg-muted/50 px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Mitarbeiter</span>
              {conversations.filter(c => c.total_unread > 0).length > 0 && (
                <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
                  {conversations.filter(c => c.total_unread > 0).length}
                </span>
              )}
            </div>
          </div>
          <ScrollArea className="h-[calc(100%-57px)]">
            {conversations.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <MailOpen className="h-16 w-16 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Posteingang ist leer</p>
                <p className="text-xs mt-1">Keine Nachrichten vorhanden</p>
              </div>
            ) : (
              conversations.map((conv) => (
              <button
                  key={conv.user_id}
                  onClick={() => {
                    setSelectedUserId(conv.user_id);
                    // Show all messages by default when opening a conversation
                    setSelectedVirtualEmployeeId("all");
                  }}
                  className={`w-full text-left px-4 py-3 border-b transition-colors ${
                    conv.total_unread > 0 ? "bg-accent/50" : "bg-background"
                  } ${
                    selectedUserId === conv.user_id
                      ? "border-l-4 border-l-primary bg-accent"
                      : "border-l-4 border-l-transparent hover:bg-accent/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {conv.total_unread > 0 ? (
                        <Circle className="h-3 w-3 fill-primary text-primary" />
                      ) : (
                        <MailOpen className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className={`text-sm truncate ${conv.total_unread > 0 ? "font-bold" : "font-medium"}`}>
                          {conv.user_name}
                        </p>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatTime(conv.last_message_time)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mb-1">
                        {conv.user_email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.last_message || "Keine Nachrichten"}
                      </p>
                    </div>
                    {conv.total_unread > 0 && (
                      <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                        {conv.total_unread}
                      </Badge>
                    )}
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </Card>

        {/* Message View */}
        <Card className="md:col-span-2 flex flex-col overflow-hidden">
          {selectedConversation ? (
            <>
              <div className="bg-muted/30 px-6 py-4 border-b">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                          {selectedConversation.user_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="text-lg font-bold">
                          {selectedConversation.user_name}
                        </h2>
                        <p className="text-sm text-muted-foreground">{selectedConversation.user_email}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Virtual Employee Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Antworten als:</span>
                    <Select value={selectedVirtualEmployeeId} onValueChange={setSelectedVirtualEmployeeId}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Kontakt wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle Nachrichten</SelectItem>
                        <SelectItem value="hr">HR-Team</SelectItem>
                        {virtualEmployees.map((ve) => (
                          <SelectItem key={ve.id} value={ve.id}>
                            {ve.first_name} {ve.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 px-6 py-4">
                <div className="space-y-6">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <p className="text-sm">Keine Nachrichten in dieser Ansicht</p>
                    </div>
                  ) : (
                    messages.map((msg, index) => (
                      <div key={msg.id} className="space-y-2">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarFallback className={msg.role === "admin" ? "bg-primary text-primary-foreground text-xs" : "bg-muted text-xs"}>
                              {msg.role === "admin" 
                                ? getVirtualEmployeeName(msg.virtual_employee_id).split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
                                : selectedConversation.user_name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="font-semibold text-sm">
                                {msg.role === "admin" 
                                  ? getVirtualEmployeeName(msg.virtual_employee_id)
                                  : msg.role === "assistant" 
                                  ? "HR-Assistent (Bot)"
                                  : selectedConversation.user_name}
                              </span>
                              {/* Show virtual employee badge for both user and admin messages */}
                              {msg.virtual_employee_id && (
                                <Badge
                                  variant={msg.role === "user" ? "secondary" : "outline"}
                                  className="text-[10px] flex items-center gap-1 cursor-pointer hover:bg-accent"
                                  onClick={() => setSelectedVirtualEmployeeId(msg.virtual_employee_id!)}
                                >
                                  <Users className="h-2.5 w-2.5" />
                                  {msg.role === "user" ? "an" : "von"} {getVirtualEmployeeName(msg.virtual_employee_id)}
                                </Badge>
                              )}
                              {!msg.virtual_employee_id && msg.role === "user" && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-[10px] flex items-center gap-1 cursor-pointer hover:bg-accent"
                                  onClick={() => setSelectedVirtualEmployeeId("hr")}
                                >
                                  <Users className="h-2.5 w-2.5" />
                                  an HR-Assistent
                                </Badge>
                              )}
                              {!msg.virtual_employee_id && msg.role === "admin" && (
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px] flex items-center gap-1 cursor-pointer hover:bg-accent"
                                  onClick={() => setSelectedVirtualEmployeeId("hr")}
                                >
                                  <Users className="h-2.5 w-2.5" />
                                  von HR-Team
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {new Date(msg.created_at).toLocaleString("de-DE", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </span>
                            </div>
                            {editingMessageId === msg.id ? (
                              <div className="space-y-2">
                                <Input
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  className="w-full"
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => handleSaveEdit(msg.id)}>
                                    <Check className="h-3 w-3 mr-1" />
                                    Speichern
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                    <X className="h-3 w-3 mr-1" />
                                    Abbrechen
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-muted/50 rounded-lg p-3 border group relative">
                                <p className="text-sm whitespace-pre-wrap leading-relaxed pr-20">{msg.message}</p>
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleEditMessage(msg.id, msg.message)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteMessage(msg.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        {index < messages.length - 1 && <div className="border-b ml-11" />}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              <div className="px-6 py-4 border-t bg-muted/20">
                {selectedVirtualEmployeeId !== "all" && (
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Antworten als: <span className="font-medium text-foreground">{getReplyAsName()}</span>
                    </span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    placeholder={selectedVirtualEmployeeId === "all" ? "Wählen Sie zuerst einen Kontakt..." : "Antwort verfassen..."}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                    disabled={isLoading || selectedVirtualEmployeeId === "all"}
                    className="flex-1"
                  />
                  <Button onClick={handleSendReply} disabled={isLoading || selectedVirtualEmployeeId === "all"}>
                    <Send className="h-4 w-4 mr-2" />
                    Senden
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground bg-muted/10">
              <div className="text-center">
                <MailOpen className="h-20 w-20 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-1">Kein Mitarbeiter ausgewählt</p>
                <p className="text-sm">Wählen Sie einen Mitarbeiter aus der Liste</p>
              </div>
            </div>
          )}
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="company">
          <CompanyMailboxTab mainEmail={contact.main_email} supportEmail={contact.support_email} />
        </TabsContent>

        <TabsContent value="postfach">
          <Documents />
        </TabsContent>
      </Tabs>
      )}
    </div>

  );
};

export default ChatInbox;
