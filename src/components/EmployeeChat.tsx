import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { MessageCircle, X, Send, Loader2, Users, Building2, ChevronRight, ChevronLeft, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/lib/toast-stub";
import { ScrollArea } from "./ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { useBrowserNotification } from "@/hooks/useBrowserNotification";
import { format, isToday, isYesterday } from "date-fns";
import { de } from "date-fns/locale";
import { getAvatarById } from "@/assets/avatars";

type Message = { 
  id?: string;
  role: "user" | "assistant" | "admin"; 
  content: string;
  created_at?: string;
};

type VirtualEmployee = {
  id: string;
  first_name: string;
  last_name: string;
  department: string;
  job_title: string;
};

export interface EmployeeChatRef {
  openWithContact: (contact: VirtualEmployee) => void;
  openHRChat: () => void;
}

export const EmployeeChat = forwardRef<EmployeeChatRef>((_, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [virtualEmployees, setVirtualEmployees] = useState<VirtualEmployee[]>([]);
  const [selectedContact, setSelectedContact] = useState<VirtualEmployee | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [unreadHRCount, setUnreadHRCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { playNotificationSound } = useNotificationSound();
  const { showNotification, requestPermission } = useBrowserNotification();

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    openWithContact: (contact: VirtualEmployee) => {
      setIsOpen(true);
      setSelectedContact(contact);
      setMessages([]);
      setShowContacts(false);
    },
    openHRChat: () => {
      setIsOpen(true);
      setSelectedContact(null);
      setMessages([]);
      setShowContacts(false);
    },
  }));

  // Determine current chat mode
  const isHRAssistant = !selectedContact;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    getUserId();
    // Request notification permission on mount
    requestPermission();
  }, []);

  useEffect(() => {
    if (isOpen && userId) {
      loadVirtualEmployees();
      if (isHRAssistant) {
        loadHRChatHistory();
      }
    }
  }, [isOpen, userId]);

  // Realtime for selected contact chat
  useEffect(() => {
    if (selectedContact && userId) {
      loadContactChatHistory(selectedContact.id);
      
      const channel = supabase
        .channel(`chat-${selectedContact.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `virtual_employee_id=eq.${selectedContact.id}`,
          },
          (payload) => {
            const newMessage = payload.new as any;
            if (newMessage.role === 'admin' && newMessage.user_id === userId) {
              setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: newMessage.message, id: newMessage.id, created_at: newMessage.created_at },
              ]);

              // Immediately mark the incoming message as read (user is currently viewing this chat)
              supabase
                .from('chat_messages')
                .update({ is_read: true })
                .eq('id', newMessage.id)
                .eq('is_read', false)
                .then(() => {
                  setUnreadCounts((prev) => {
                    const next = { ...prev };
                    delete next[selectedContact.id];
                    return next;
                  });
                });

              // Play sound and show notification
              playNotificationSound();
              showNotification(`Neue Nachricht von ${selectedContact.first_name}`, {
                body: newMessage.message.substring(0, 100),
                tag: `chat-${newMessage.id}`,
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedContact, userId, playNotificationSound, showNotification]);

  // Realtime for HR Assistant
  useEffect(() => {
    if (isOpen && userId && isHRAssistant) {
      const channel = supabase
        .channel('hr-chat-messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const newMessage = payload.new as any;
            if (newMessage.role === 'admin' && !newMessage.virtual_employee_id) {
              setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: newMessage.message, created_at: newMessage.created_at },
              ]);

              // Immediately mark the incoming HR message as read (user is currently viewing HR chat)
              supabase
                .from('chat_messages')
                .update({ is_read: true })
                .eq('id', newMessage.id)
                .eq('is_read', false)
                .then(() => setUnreadHRCount(0));
              
              // Play sound and show notification
              playNotificationSound();
              showNotification('Neue Nachricht vom HR-Team', {
                body: newMessage.message.substring(0, 100),
                tag: `hr-chat-${newMessage.id}`,
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen, userId, isHRAssistant, playNotificationSound, showNotification]);

  // Global realtime listener for notifications when chat is closed
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('employee-global-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const newMessage = payload.new as any;
          // Only notify for admin messages
          if (newMessage.role === 'admin') {
            const isForOpenContact =
              isOpen &&
              selectedContact &&
              newMessage.virtual_employee_id &&
              newMessage.virtual_employee_id === selectedContact.id;

            const isForOpenHR = isOpen && isHRAssistant && !newMessage.virtual_employee_id;

            // If user is currently viewing the conversation, mark as read and don't bump badges
            if (isForOpenContact || isForOpenHR) {
              await supabase
                .from('chat_messages')
                .update({ is_read: true })
                .eq('id', newMessage.id)
                .eq('is_read', false);

              if (isForOpenContact) {
                setUnreadCounts((prev) => {
                  const next = { ...prev };
                  delete next[selectedContact!.id];
                  return next;
                });
              } else {
                setUnreadHRCount(0);
              }

              return;
            }

            // Reload unread counts
            loadVirtualEmployees();

            // Play sound if chat is closed
            if (!isOpen) {
              playNotificationSound();

              if (newMessage.virtual_employee_id) {
                // Find the virtual employee name
                const emp = virtualEmployees.find(e => e.id === newMessage.virtual_employee_id);
                const senderName = emp ? `${emp.first_name} ${emp.last_name}` : 'einem Kontakt';
                showNotification(`Neue Nachricht von ${senderName}`, {
                  body: newMessage.message.substring(0, 100),
                  tag: `notification-${newMessage.id}`,
                });
              } else {
                showNotification('Neue Nachricht vom HR-Team', {
                  body: newMessage.message.substring(0, 100),
                  tag: `notification-${newMessage.id}`,
                });
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isOpen, virtualEmployees, playNotificationSound, showNotification]);
  const loadVirtualEmployees = async () => {
    const { data, error } = await supabase
      .from("virtual_employees")
      .select("id, first_name, last_name, department, job_title")
      .eq("is_active", true)
      .order("department")
      .order("last_name");

    if (error) {
      console.error("Error loading virtual employees:", error);
      return;
    }

    setVirtualEmployees(data || []);

    // Load unread counts for contacts
    if (userId && data) {
      const counts: Record<string, number> = {};
      const now = new Date().toISOString();
      
      for (const emp of data) {
        const { count } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("virtual_employee_id", emp.id)
          .eq("user_id", userId)
          .eq("role", "admin")
          .eq("is_read", false)
          .lte("created_at", now); // Only count messages that should be visible now
        
        if (count && count > 0) {
          counts[emp.id] = count;
        }
      }
      setUnreadCounts(counts);

      // Load unread count for HR messages
      const { count: hrCount } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("virtual_employee_id", null)
        .eq("role", "admin")
        .eq("is_read", false)
        .lte("created_at", now); // Only count messages that should be visible now
      
      setUnreadHRCount(hrCount || 0);
    }
  };

  const loadHRChatHistory = async () => {
    if (!userId) return;

    setIsLoadingHistory(true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", userId)
        .is("virtual_employee_id", null)
        .in("role", ["user", "assistant", "admin"])
        .lte("created_at", now) // Only show messages that should be visible now
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data) {
        const formattedMessages: Message[] = data.map((msg) => ({
          id: msg.id,
          role: msg.role === "admin" ? "assistant" : msg.role as "user" | "assistant",
          content: msg.message,
          created_at: msg.created_at,
        }));
        setMessages(formattedMessages);

        // Mark HR messages as read (only those that are visible now)
        await supabase
          .from("chat_messages")
          .update({ is_read: true })
          .eq("user_id", userId)
          .is("virtual_employee_id", null)
          .eq("role", "admin")
          .eq("is_read", false)
          .lte("created_at", now);

        setUnreadHRCount(0);
      }
    } catch (error) {
      console.error("Error loading HR chat history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadContactChatHistory = async (virtualEmployeeId: string) => {
    if (!userId) return;

    setIsLoadingHistory(true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("virtual_employee_id", virtualEmployeeId)
        .eq("user_id", userId)
        .lte("created_at", now) // Only show messages that should be visible now
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data) {
        const formattedMessages: Message[] = data.map((msg) => ({
          id: msg.id,
          role: msg.role === "admin" ? "assistant" : msg.role as "user" | "assistant",
          content: msg.message,
          created_at: msg.created_at,
        }));
        setMessages(formattedMessages);

        // Mark as read (only those that are visible now)
        const { error: updateError } = await supabase
          .from("chat_messages")
          .update({ is_read: true })
          .eq("virtual_employee_id", virtualEmployeeId)
          .eq("user_id", userId)
          .eq("role", "admin")
          .eq("is_read", false)
          .lte("created_at", now);

        if (!updateError) {
          // Immediately update local state
          setUnreadCounts((prev) => {
            const newCounts = { ...prev };
            delete newCounts[virtualEmployeeId];
            return newCounts;
          });
        }
      }
    } catch (error) {
      console.error("Error loading contact chat history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const getUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
    
    // Load user's avatar
    if (user?.id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();
      
      if (profileData && (profileData as any).avatar_url) {
        setUserAvatarUrl((profileData as any).avatar_url);
      }
    }
  };

  // HR Assistant - uses edge function
  const sendToHRAssistant = async (userMessage: string) => {
    setIsLoading(true);
    try {
      // Save user message
      await supabase.from("chat_messages").insert({
        user_id: userId,
        message: userMessage,
        role: "user",
        is_read: false,
      });

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-chat`;
      const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
        },
        body: JSON.stringify({ message: userMessage, userId }),
      });

      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        throw new Error(t || `Request failed (${resp.status})`);
      }

      const data = await resp.json();
      
      // Only show and save response if admin is offline and there's an answer
      if (data.answer) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);

        await supabase.from("chat_messages").insert({
          user_id: userId,
          message: data.answer,
          role: "assistant",
          is_read: true,
        });
      }
      // If admin is online (data.adminOnline = true), no automatic message is shown
      // The user's message is saved, admin will respond manually
    } catch (error) {
      console.error("Chat error:", error);
      toast({
        title: "Fehler",
        description: "Nachricht konnte nicht gesendet werden",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Contact message
  const sendToContact = async (userMessage: string, virtualEmployeeId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from("chat_messages").insert({
        user_id: userId,
        message: userMessage,
        role: "user",
        is_read: false,
        virtual_employee_id: virtualEmployeeId,
      });

      if (error) throw error;

      toast({
        title: "Nachricht gesendet",
        description: `${selectedContact?.first_name} wird sich bei dir melden.`,
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Nachricht konnte nicht gesendet werden",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    const messageText = input.trim();
    setInput("");

    if (isHRAssistant) {
      await sendToHRAssistant(messageText);
    } else if (selectedContact) {
      await sendToContact(messageText, selectedContact.id);
    }
  };

  const selectContact = async (emp: VirtualEmployee) => {
    // First, mark current contact's messages as read before switching
    if (selectedContact && userId) {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("chat_messages")
        .update({ is_read: true })
        .eq("virtual_employee_id", selectedContact.id)
        .eq("user_id", userId)
        .eq("role", "admin")
        .eq("is_read", false)
        .lte("created_at", now);
      
      if (!error) {
        // Remove from unread counts immediately
        setUnreadCounts((prev) => {
          const newCounts = { ...prev };
          delete newCounts[selectedContact.id];
          return newCounts;
        });
      }
    }
    
    setSelectedContact(emp);
    setMessages([]);
    setShowContacts(false);
  };

  const backToHRAssistant = async () => {
    // First, mark current contact's messages as read before switching
    if (selectedContact && userId) {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("chat_messages")
        .update({ is_read: true })
        .eq("virtual_employee_id", selectedContact.id)
        .eq("user_id", userId)
        .eq("role", "admin")
        .eq("is_read", false)
        .lte("created_at", now);
      
      if (!error) {
        // Remove from unread counts immediately
        setUnreadCounts((prev) => {
          const newCounts = { ...prev };
          delete newCounts[selectedContact.id];
          return newCounts;
        });
      }
    }
    
    setSelectedContact(null);
    setMessages([]);
    setShowContacts(false);
    if (userId) loadHRChatHistory();
  };

  const closeChat = async () => {
    // Mark current chat messages as read before closing
    if (userId) {
      const now = new Date().toISOString();
      if (selectedContact) {
        const { error } = await supabase
          .from("chat_messages")
          .update({ is_read: true })
          .eq("virtual_employee_id", selectedContact.id)
          .eq("user_id", userId)
          .eq("role", "admin")
          .eq("is_read", false)
          .lte("created_at", now);
        
        if (!error) {
          setUnreadCounts((prev) => {
            const newCounts = { ...prev };
            delete newCounts[selectedContact.id];
            return newCounts;
          });
        }
      } else {
        // HR Assistant chat
        const { error } = await supabase
          .from("chat_messages")
          .update({ is_read: true })
          .eq("user_id", userId)
          .is("virtual_employee_id", null)
          .eq("role", "admin")
          .eq("is_read", false)
          .lte("created_at", now);
        
        if (!error) {
          setUnreadHRCount(0);
        }
      }
    }
    setIsOpen(false);
  };

  const groupedEmployees = virtualEmployees.reduce((acc, emp) => {
    if (!acc[emp.department]) {
      acc[emp.department] = [];
    }
    acc[emp.department].push(emp);
    return acc;
  }, {} as Record<string, VirtualEmployee[]>);

  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0) + unreadHRCount;

  // Format message time
  const formatMessageTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, "HH:mm", { locale: de });
    } else if (isYesterday(date)) {
      return "Gestern " + format(date, "HH:mm", { locale: de });
    }
    return format(date, "dd.MM. HH:mm", { locale: de });
  };

  // Group messages by date
  const getDateLabel = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isToday(date)) {
      return "Heute";
    } else if (isYesterday(date)) {
      return "Gestern";
    }
    return format(date, "d. MMMM yyyy", { locale: de });
  };
  return (
    <>
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 md:bottom-4 rounded-full h-14 w-14 shadow-lg z-50"
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {totalUnread}
            </span>
          )}
        </Button>
      ) : (
        <div className="fixed bottom-20 right-4 md:bottom-4 flex gap-2 items-end flex-col-reverse md:flex-row z-50">
          {/* Contacts Panel - slides out, opens upward on mobile */}
          {showContacts && (
            <Card className="w-72 shadow-2xl h-[400px] md:h-[500px] flex flex-col animate-in slide-in-from-bottom-5 md:slide-in-from-right-5 mb-16 md:mb-0 bg-background z-50">
              <CardHeader className="py-3 px-4 border-b flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Kontakte</CardTitle>
                  {totalUnread > 0 && (
                    <Badge variant="destructive" className="text-xs ml-auto">
                      {totalUnread}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <ScrollArea className="flex-1 h-0"  style={{ minHeight: 0 }}>
                <div className="p-3 space-y-3">
                  {Object.entries(groupedEmployees).map(([department, employees]) => (
                    <div key={department}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          {department}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {employees.map((emp) => (
                          <button
                            key={emp.id}
                            onClick={() => selectContact(emp)}
                            className={`w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent transition-colors text-left ${
                              selectedContact?.id === emp.id ? "bg-accent" : ""
                            }`}
                          >
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={getAvatarById(emp.id)} alt={`${emp.first_name} ${emp.last_name}`} />
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                {emp.first_name[0]}{emp.last_name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">
                                {emp.first_name} {emp.last_name}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {emp.job_title}
                              </p>
                            </div>
                            {unreadCounts[emp.id] && (
                              <Badge variant="destructive" className="text-[10px] h-4 px-1">
                                {unreadCounts[emp.id]}
                              </Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}

          {/* Main Chat Card */}
          <Card className="w-[420px] shadow-2xl max-h-[650px] flex flex-col border-0 ring-1 ring-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4 flex-shrink-0 bg-gradient-to-r from-primary/5 to-primary/10 border-b">
              <div className="flex items-center gap-2">
                {selectedContact ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={backToHRAssistant}
                      className="h-7 w-7 relative"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {unreadHRCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] rounded-full h-4 w-4 flex items-center justify-center font-medium">
                          {unreadHRCount}
                        </span>
                      )}
                    </Button>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={getAvatarById(selectedContact.id)} alt={`${selectedContact.first_name} ${selectedContact.last_name}`} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {selectedContact.first_name[0]}{selectedContact.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-sm">
                        {selectedContact.first_name} {selectedContact.last_name}
                      </CardTitle>
                      <p className="text-[10px] text-muted-foreground">{selectedContact.job_title}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                      <AvatarFallback className="text-sm font-semibold bg-primary text-primary-foreground">
                        HR
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base font-semibold">HR-Assistent</CardTitle>
                      <p className="text-xs text-muted-foreground">Fragen zu Gehalt, Urlaub & mehr</p>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-primary/10"
                  title="Chat-Informationen"
                >
                  <Info className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowContacts(!showContacts)}
                  className="h-8 w-8 relative rounded-full hover:bg-primary/10"
                  title="Kontakte anzeigen"
                >
                  {showContacts ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                  {totalUnread > 0 && !showContacts && (
                    <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] rounded-full h-4 w-4 flex items-center justify-center font-medium">
                      {totalUnread}
                    </span>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await closeChat();
                    setSelectedContact(null);
                    setShowContacts(false);
                    setMessages([]);
                  }}
                  className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
                  title="Chat schließen"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
              <ScrollArea className="flex-1 px-4 py-3">
                <div className="space-y-3">
                  {isLoadingHistory ? (
                    <div className="flex justify-center items-center py-16">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-10">
                      {isHRAssistant ? (
                        <>
                          <Avatar className="h-20 w-20 mx-auto mb-4 ring-4 ring-primary/20">
                            <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                              HR
                            </AvatarFallback>
                          </Avatar>
                          <p className="text-base font-medium mb-1">Hallo! 👋</p>
                          <p className="text-sm text-muted-foreground">
                            Ich bin dein HR-Assistent.<br />
                            Wie kann ich dir helfen?
                          </p>
                          <div className="flex flex-wrap justify-center gap-2 mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs rounded-full"
                              onClick={() => {
                                setInput("Wann wird mein Gehalt überwiesen?");
                              }}
                            >
                              💰 Gehalt
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs rounded-full"
                              onClick={() => {
                                setInput("Wie beantrage ich Urlaub?");
                              }}
                            >
                              🏖️ Urlaub
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs rounded-full"
                              onClick={() => {
                                setInput("Wo finde ich meine Dokumente?");
                              }}
                            >
                              📄 Dokumente
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <Avatar className="h-20 w-20 mx-auto mb-4 ring-4 ring-primary/10">
                            <AvatarImage src={selectedContact ? getAvatarById(selectedContact.id) : undefined} alt={`${selectedContact?.first_name} ${selectedContact?.last_name}`} />
                            <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
                              {selectedContact?.first_name[0]}{selectedContact?.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <p className="text-base font-medium mb-1">
                            {selectedContact?.first_name} {selectedContact?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Schreibe eine Nachricht, um zu beginnen!
                          </p>
                        </>
                      )}
                    </div>
                  ) : null}
                  {messages.map((msg, i) => {
                    // Show date separator
                    const showDateSeparator = i === 0 || (
                      msg.created_at && messages[i - 1]?.created_at &&
                      getDateLabel(msg.created_at) !== getDateLabel(messages[i - 1]?.created_at)
                    );
                    
                    return (
                      <div key={i}>
                        {showDateSeparator && msg.created_at && (
                          <div className="flex items-center justify-center my-4">
                            <span className="text-[10px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
                              {getDateLabel(msg.created_at)}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} group`}>
                          <div className={`flex gap-2 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                            {/* Avatar */}
                            <Avatar className="h-6 w-6 shrink-0 mt-1">
                              {msg.role === "user" ? (
                                <>
                                  <AvatarImage src={userAvatarUrl || undefined} alt="Mein Profilbild" />
                                  <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                                    ICH
                                  </AvatarFallback>
                                </>
                              ) : (
                                <>
                                  <AvatarImage src={selectedContact ? getAvatarById(selectedContact.id) : undefined} />
                                  <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                                    {selectedContact 
                                      ? `${selectedContact.first_name[0]}${selectedContact.last_name[0]}`
                                      : "HR"
                                    }
                                  </AvatarFallback>
                                </>
                              )}
                            </Avatar>
                            <div className="flex flex-col gap-1">
                              {/* Show sender name */}
                              <span className={`text-[11px] font-medium text-muted-foreground ${msg.role === "user" ? "text-right" : "text-left"}`}>
                                {msg.role === "user" 
                                  ? "Du"
                                  : selectedContact 
                                    ? `${selectedContact.first_name} ${selectedContact.last_name}`
                                    : "HR-Assistent"
                                }
                              </span>
                              <div
                                className={`rounded-2xl px-4 py-2.5 ${
                                  msg.role === "user"
                                    ? "bg-primary text-primary-foreground rounded-br-md"
                                    : "bg-muted rounded-bl-md"
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                              </div>
                              {msg.created_at && (
                                <span className={`text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ${
                                  msg.role === "user" ? "text-right" : "text-left"
                                }`}>
                                  {formatMessageTime(msg.created_at)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="flex gap-2 p-4 border-t bg-background/80 backdrop-blur-sm">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Nachricht eingeben..."
                  disabled={isLoading}
                  className="rounded-full border-muted-foreground/20 focus-visible:ring-primary/30"
                />
                <Button 
                  onClick={handleSend} 
                  size="icon" 
                  disabled={isLoading || !input.trim()}
                  className="rounded-full h-10 w-10 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
});

EmployeeChat.displayName = "EmployeeChat";
