import { useEffect, useState, useRef } from "react";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { useBrowserNotification } from "@/hooks/useBrowserNotification";
import { useToast } from "@/lib/toast-stub";

type Notification = {
  id: string;
  message: string;
  type: string;
  created_at: string;
  is_read: boolean;
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { playNotificationSound } = useNotificationSound();
  const { permission, requestPermission, showNotification, isSupported } = useBrowserNotification();
  const { toast } = useToast();
  const previousUnreadCountRef = useRef(0);
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    // Load sound preference from localStorage
    const savedSoundPref = localStorage.getItem("notification-sound");
    if (savedSoundPref !== null) {
      setSoundEnabled(savedSoundPref === "true");
    }

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserId(user.id);
      
      // Check if user is admin
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      const adminStatus = roles?.some((r) => r.role === "admin") || false;
      setIsAdmin(adminStatus);
      
      loadNotifications(user.id, adminStatus);
    };

    init();
    const cleanup = subscribeToNotifications();

    // Request browser notification permission
    if (isSupported && permission === "default") {
      requestPermission();
    }

    return cleanup;
  }, []);

  const loadNotifications = async (userId?: string, adminStatus?: boolean) => {
    const uid = userId || currentUserId;
    const admin = adminStatus !== undefined ? adminStatus : isAdmin;
    
    if (!uid) return;

    let newNotifications: Notification[] = [];

    if (admin) {
      // Admins see admin_notifications
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("id, message, type, is_read, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error loading admin notifications:", error);
        return;
      }
      newNotifications = (data || []).map(n => ({
        id: n.id,
        message: n.message,
        type: n.type,
        is_read: n.is_read || false,
        created_at: n.created_at || new Date().toISOString()
      }));
    } else {
      // Employees see unread chat messages from admins + unread emails in their inbox
      const [chatResult, emailResult] = await Promise.all([
        supabase
          .from("chat_messages")
          .select("id, message, created_at, is_read, virtual_employee_id")
          .eq("user_id", uid)
          .eq("role", "admin")
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(10),
        // Get unread emails from received_emails linked to user's submissions
        supabase
          .from("task_submissions")
          .select("id")
          .eq("employee_id", uid)
      ]);

      if (chatResult.error) {
        console.error("Error loading chat notifications:", chatResult.error);
      }
      
      // Get unread emails for the user's submissions
      let emailNotifications: Notification[] = [];
      if (emailResult.data && emailResult.data.length > 0) {
        const submissionIds = emailResult.data.map(s => s.id);
        const { data: emails, error: emailsError } = await supabase
          .from("received_emails")
          .select("id, subject, from_address, received_at, is_read, submission_id")
          .in("submission_id", submissionIds)
          .eq("is_read", false)
          .order("received_at", { ascending: false })
          .limit(10);

        if (emailsError) {
          console.error("Error loading email notifications:", emailsError);
        } else {
          emailNotifications = (emails || []).map(e => ({
            id: e.id,
            message: e.subject ? (e.subject.length > 50 ? e.subject.substring(0, 50) + "..." : e.subject) : "Neue Nachricht",
            type: "email_message",
            is_read: e.is_read,
            created_at: e.received_at
          }));
        }
      }
      
      const chatNotifications = (chatResult.data || []).map(n => ({
        id: n.id,
        message: n.message.length > 50 ? n.message.substring(0, 50) + "..." : n.message,
        type: "chat_message",
        is_read: n.is_read,
        created_at: n.created_at
      }));

      // Combine and sort by date
      newNotifications = [...chatNotifications, ...emailNotifications]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20);
    }

    const newUnreadCount = newNotifications.filter((n) => !n.is_read).length;

    setNotifications(newNotifications);
    setUnreadCount(newUnreadCount);

    // Skip sound/notification on first load
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      previousUnreadCountRef.current = newUnreadCount;
      return;
    }

    // Check if there are new unread notifications
    if (newUnreadCount > previousUnreadCountRef.current) {
      const newestNotification = newNotifications.find((n) => !n.is_read);
      
      // Play sound if enabled
      if (soundEnabled) {
        playNotificationSound();
      }

      // Show browser notification
      if (newestNotification) {
        showNotification("Neue Nachricht", {
          body: newestNotification.message,
          tag: newestNotification.id,
        });
      }

      // Show toast notification
      if (newestNotification) {
        toast({
          title: "📬 Neue Nachricht",
          description: newestNotification.message,
        });
      }
    }

    previousUnreadCountRef.current = newUnreadCount;
  };

  const subscribeToNotifications = () => {
    // Subscribe to admin_notifications for admins
    const adminChannel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "admin_notifications",
        },
        () => {
          if (isAdmin) {
            loadNotifications();
          }
        }
      )
      .subscribe();

    // Subscribe to chat_messages for employees
    const chatChannel = supabase
      .channel("employee-chat-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
        },
        () => {
          if (!isAdmin) {
            loadNotifications();
          }
        }
      )
      .subscribe();

    // Subscribe to received_emails for employees
    const emailChannel = supabase
      .channel("employee-email-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "received_emails",
        },
        () => {
          if (!isAdmin) {
            loadNotifications();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(adminChannel);
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(emailChannel);
    };
  };

  const toggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem("notification-sound", String(newValue));
    
    if (newValue) {
      playNotificationSound();
    }
    
    toast({
      title: newValue ? "🔔 Sound aktiviert" : "🔕 Sound deaktiviert",
      description: newValue 
        ? "Sie hören jetzt einen Ton bei neuen Nachrichten" 
        : "Benachrichtigungstöne sind jetzt stumm",
    });
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (isAdmin) {
      // Mark admin notification as read
      await supabase
        .from("admin_notifications")
        .update({ is_read: true })
        .eq("id", notification.id);
      
      navigate("/dashboard/admin/chat-inbox");
    } else {
      if (notification.type === "chat_message") {
        // Mark chat message as read
        await supabase
          .from("chat_messages")
          .update({ is_read: true })
          .eq("id", notification.id);
        
        // Dispatch event to open chat (Dashboard listens for this)
        window.dispatchEvent(new CustomEvent("open-employee-chat"));
        
        // Navigate to dashboard if not already there
        if (!window.location.pathname.includes("/dashboard")) {
          navigate("/dashboard");
        }
      } else if (notification.type === "email_message") {
        // Mark email as read
        await supabase
          .from("received_emails")
          .update({ is_read: true })
          .eq("id", notification.id);
        
        // Navigate to documents/inbox
        navigate("/dashboard/documents");
      }
    }
    
    // Immediately update local state
    setNotifications(prev => prev.map(n => 
      n.id === notification.id ? { ...n, is_read: true } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!currentUserId) return;
    
    if (isAdmin) {
      await supabase
        .from("admin_notifications")
        .update({ is_read: true })
        .eq("is_read", false);
    } else {
      // Mark all chat messages as read
      await supabase
        .from("chat_messages")
        .update({ is_read: true })
        .eq("user_id", currentUserId)
        .eq("role", "admin")
        .eq("is_read", false);
      
      // Mark all emails as read for user's submissions
      const { data: submissions } = await supabase
        .from("task_submissions")
        .select("id")
        .eq("employee_id", currentUserId);
      
      if (submissions && submissions.length > 0) {
        const submissionIds = submissions.map(s => s.id);
        await supabase
          .from("received_emails")
          .update({ is_read: true })
          .in("submission_id", submissionIds)
          .eq("is_read", false);
      }
    }
    
    // Immediately reset state to reflect the change
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    previousUnreadCountRef.current = 0;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Benachrichtigungen</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleSound();
            }}
            className="h-6 w-6 p-0"
            title={soundEnabled ? "Sound deaktivieren" : "Sound aktivieren"}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Keine Benachrichtigungen
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`cursor-pointer flex flex-col items-start gap-1 p-3 ${
                  !notification.is_read ? "bg-blue-50 dark:bg-blue-950" : ""
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-center gap-2 w-full">
                  {!notification.is_read && (
                    <span className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                  )}
                  <span className="text-sm font-medium flex-1">
                    {notification.message}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground ml-4">
                  {formatDistanceToNow(new Date(notification.created_at), {
                    addSuffix: true,
                    locale: de,
                  })}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
