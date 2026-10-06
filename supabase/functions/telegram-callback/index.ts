import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Escape special characters for Telegram HTML parse mode
function escapeTelegramHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const update = await req.json();
    
    console.log("Received Telegram update:", JSON.stringify(update, null, 2));

    // Handle text messages (could be replies to pending chat or notes)
    if (update.message?.text && !update.message.text.startsWith("/") && update.message.reply_to_message) {
      const chatId = update.message.chat.id;
      const replyText = update.message.text;
      const replyToMessageId = update.message.reply_to_message.message_id;
      
      console.log("Checking for pending reply to message:", replyToMessageId);
      
      // Check if this is a reply to a pending chat reply prompt
      const { data: pendingReply, error: pendingError } = await supabase
        .from("telegram_pending_replies")
        .select("*")
        .eq("chat_id", chatId)
        .eq("prompt_message_id", replyToMessageId)
        .gt("expires_at", new Date().toISOString())
        .single();
      
      if (pendingReply && !pendingError) {
        console.log("Found pending reply:", pendingReply);
        
        // Check if this is a task notes edit (persona_id starts with "tasknote_")
        if (pendingReply.persona_id.startsWith("tasknote_")) {
          const mode = pendingReply.persona_id.replace("tasknote_", ""); // "replace" or "append"
          const submissionId = pendingReply.original_message_id; // We store submission_id here
          
          console.log("Processing task notes edit:", { mode, submissionId });
          
          // Get current notes if appending
          let newNotes = replyText;
          if (mode === "append") {
            const { data: currentSubmission } = await supabase
              .from("task_submissions")
              .select("notes")
              .eq("id", submissionId)
              .single();
            
            const timestamp = new Date().toLocaleDateString('de-DE', { 
              day: '2-digit', month: '2-digit', year: 'numeric', 
              hour: '2-digit', minute: '2-digit' 
            });
            const existingNotes = currentSubmission?.notes || "";
            newNotes = existingNotes 
              ? `${existingNotes}\n\n[${timestamp}]\n${replyText}`
              : `[${timestamp}]\n${replyText}`;
          }
          
          // Update task submission with new notes
          const { error: updateError } = await supabase
            .from("task_submissions")
            .update({ notes: newNotes })
            .eq("id", submissionId);
          
          // Delete prompt and reply messages
          await deleteMessage(TELEGRAM_BOT_TOKEN, chatId, replyToMessageId);
          await deleteMessage(TELEGRAM_BOT_TOKEN, chatId, update.message.message_id);
          
          if (updateError) {
            console.error("Error updating task notes:", updateError);
            const errResp = await sendHtmlMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ Fehler beim Speichern der Auftrags-Notiz.");
            if (errResp?.message_id) {
              scheduleMessageDeletion(TELEGRAM_BOT_TOKEN, chatId, errResp.message_id, 30000);
            }
          } else {
            const modeText = mode === "append" ? "angehängt" : "gespeichert";
            const confirmResp = await sendHtmlMessage(TELEGRAM_BOT_TOKEN, chatId, 
              `✅ <b>Auftrags-Notiz ${modeText}</b>`
            );
            if (confirmResp?.message_id) {
              scheduleMessageDeletion(TELEGRAM_BOT_TOKEN, chatId, confirmResp.message_id, 30000);
            }
            console.log("Task notes updated successfully");
          }
          
          // Delete pending reply entry
          await supabase
            .from("telegram_pending_replies")
            .delete()
            .eq("id", pendingReply.id);
          
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }
        
        // Regular chat reply handling
        let personaName = "HR-Team";
        let virtualEmployeeId: string | null = null;
        
        if (pendingReply.persona_id !== "hr") {
          virtualEmployeeId = pendingReply.persona_id;
          const { data: ve } = await supabase
            .from("virtual_employees")
            .select("first_name, last_name")
            .eq("id", pendingReply.persona_id)
            .single();
          
          if (ve) {
            personaName = `${ve.first_name} ${ve.last_name}`;
          }
        }
        
        // Insert chat message as admin response
        const { error: insertError } = await supabase
          .from("chat_messages")
          .insert({
            user_id: pendingReply.target_user_id,
            message: replyText,
            role: "admin",
            is_read: false,
            virtual_employee_id: virtualEmployeeId,
          });
        
        if (insertError) {
          console.error("Error inserting chat reply:", insertError);
          await sendHtmlMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ Fehler beim Senden der Antwort.");
        } else {
          // Delete the prompt message
          await deleteMessage(TELEGRAM_BOT_TOKEN, chatId, replyToMessageId);
          
          // Delete user's reply message
          await deleteMessage(TELEGRAM_BOT_TOKEN, chatId, update.message.message_id);
          
          // Send confirmation (stays for 5 minutes)
          const confirmResp = await sendHtmlMessage(TELEGRAM_BOT_TOKEN, chatId, 
            `✅ <b>Antwort gesendet</b> als ${escapeTelegramHtml(personaName)}`
          );
          
          if (confirmResp?.message_id) {
            // Delete after 5 minutes (300000ms)
            scheduleMessageDeletion(TELEGRAM_BOT_TOKEN, chatId, confirmResp.message_id, 5 * 60 * 1000);
          }
          
          console.log("Chat reply sent successfully");
        }
        
        // Delete pending reply entry
        await supabase
          .from("telegram_pending_replies")
          .delete()
          .eq("id", pendingReply.id);
        
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
    }

    // Handle /on command - activate live monitoring
    if (update.message?.text?.startsWith("/on")) {
      const chatId = update.message.chat.id;
      const userMessageId = update.message.message_id;
      
      console.log("Handling /on command - activating live monitoring");

      // Delete user's command message
      await deleteMessage(TELEGRAM_BOT_TOKEN, chatId, userMessageId);

      // Deactivate any existing monitoring for this chat
      await supabase
        .from("telegram_monitoring")
        .update({ is_active: false })
        .eq("chat_id", chatId);

      // Create new active monitoring entry
      const { error: insertError } = await supabase
        .from("telegram_monitoring")
        .insert({
          chat_id: chatId,
          is_active: true,
          activated_at: new Date().toISOString(),
        });

      let responseMessageId: number | null = null;
      if (insertError) {
        console.error("Error activating monitoring:", insertError);
        const resp = await sendHtmlMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ Fehler beim Aktivieren der Live-Überwachung.");
        responseMessageId = resp?.message_id ?? null;
      } else {
        const resp = await sendHtmlMessage(TELEGRAM_BOT_TOKEN, chatId, 
          "✅ <b>Live-Überwachung aktiviert!</b>\n\n" +
          "Du erhältst jetzt Benachrichtigungen zu:\n" +
          "📧 Neue E-Mails (mit Links & Codes)\n" +
          "📱 Neue SMS (mit Verifizierungscodes)\n\n" +
          "Zum Deaktivieren: /off"
        );
        responseMessageId = resp?.message_id ?? null;
      }

      // Schedule auto-delete after 30 seconds
      if (responseMessageId) {
        scheduleMessageDeletion(TELEGRAM_BOT_TOKEN, chatId, responseMessageId, 30000);
      }

      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // Handle /off command - deactivate live monitoring
    if (update.message?.text?.startsWith("/off")) {
      const chatId = update.message.chat.id;
      const userMessageId = update.message.message_id;
      
      console.log("Handling /off command - deactivating live monitoring");

      // Delete user's command message
      await deleteMessage(TELEGRAM_BOT_TOKEN, chatId, userMessageId);

      const { error: updateError } = await supabase
        .from("telegram_monitoring")
        .update({ is_active: false })
        .eq("chat_id", chatId)
        .eq("is_active", true);

      let responseMessageId: number | null = null;
      if (updateError) {
        console.error("Error deactivating monitoring:", updateError);
        const resp = await sendHtmlMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ Fehler beim Deaktivieren.");
        responseMessageId = resp?.message_id ?? null;
      } else {
        const resp = await sendHtmlMessage(TELEGRAM_BOT_TOKEN, chatId, 
          "🔕 <b>Live-Überwachung deaktiviert.</b>\n\n" +
          "Zum Reaktivieren: /on"
        );
        responseMessageId = resp?.message_id ?? null;
      }

      // Schedule auto-delete after 30 seconds
      if (responseMessageId) {
        scheduleMessageDeletion(TELEGRAM_BOT_TOKEN, chatId, responseMessageId, 30000);
      }

      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // Handle /worker command - list all employees
    if (update.message?.text?.startsWith("/worker")) {
      const chatId = update.message.chat.id;
      const userMessageId = update.message.message_id;
      
      console.log("Handling /worker command - listing all employees");

      // Delete user's command message
      await deleteMessage(TELEGRAM_BOT_TOKEN, chatId, userMessageId);

      // Delete all previous worker list messages for this chat
      // (We can't use telegram_id_map for this because entity is constrained)
      const { data: oldWorkerMessages, error: oldWorkerErr } = await supabase
        .from("telegram_message_registry")
        .select("id, message_id")
        .eq("chat_id", chatId)
        .eq("scope", "worker_list");

      if (oldWorkerErr) {
        console.error("Failed to load old /worker messages:", oldWorkerErr);
      }

      if (oldWorkerMessages && oldWorkerMessages.length > 0) {
        console.log(`Deleting ${oldWorkerMessages.length} old /worker messages for chat ${chatId}`);
        const deletableRegistryIds: string[] = [];

        for (const msg of oldWorkerMessages) {
          // NOTE: bigint columns (int8) are commonly returned as strings by PostgREST.
          // Telegram requires numeric message_id.
          const rawMessageId: unknown = (msg as any).message_id;
          const numericMessageId =
            typeof rawMessageId === "number"
              ? rawMessageId
              : typeof rawMessageId === "string"
                ? Number(rawMessageId)
                : NaN;

          if (!Number.isFinite(numericMessageId)) {
            console.warn(
              "Skipping delete for invalid message_id from registry:",
              JSON.stringify({ chatId, registryId: msg.id, rawMessageId })
            );
            continue;
          }

          const result = await deleteMessageWithInfo(TELEGRAM_BOT_TOKEN, chatId, numericMessageId);

          // If Telegram says "not found", treat as already deleted and clear the registry row.
          const alreadyGone =
            !result.ok &&
            typeof result.description === "string" &&
            /message to delete not found|message_id_invalid/i.test(result.description);

          if (result.ok || alreadyGone) {
            deletableRegistryIds.push(msg.id);
          } else {
            console.warn(
              "Telegram deleteMessage failed:",
              JSON.stringify({
                chatId,
                messageId: numericMessageId,
                error_code: result.error_code,
                description: result.description,
              })
            );
          }
        }

        // IMPORTANT: Only remove registry rows we successfully deleted (or that Telegram confirms are gone).
        // If deletion fails (e.g. missing permissions / too old), keep the row so the next /worker retries.
        if (deletableRegistryIds.length > 0) {
          const { error: clearErr } = await supabase
            .from("telegram_message_registry")
            .delete()
            .in("id", deletableRegistryIds);

          if (clearErr) {
            console.error("Failed to clear deleted /worker registry rows:", clearErr);
          }
        }
      }

      // Fetch only employees with Telegram forwarding ENABLED (🔔)
      // When toggle is OFF (🔕), they disappear from this list
      // Note: Chat messages are still always forwarded regardless of this setting
      const { data: employees, error: empError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, verified, created_at, telegram_notifications_enabled")
        .eq("verified", true)
        .neq("telegram_notifications_enabled", false)
        .order("created_at", { ascending: false });

      if (empError) {
        console.error("Error fetching employees:", empError);
        const errResp = await sendHtmlMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ Fehler beim Laden der Mitarbeiter.");
        if (errResp?.message_id) {
          scheduleMessageDeletion(TELEGRAM_BOT_TOKEN, chatId, errResp.message_id, 30000);
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      if (!employees || employees.length === 0) {
        const emptyResp = await sendHtmlMessage(TELEGRAM_BOT_TOKEN, chatId, "📋 Keine Mitarbeiter mit aktiver Weiterleitung gefunden.");
        if (emptyResp?.message_id) {
          scheduleMessageDeletion(TELEGRAM_BOT_TOKEN, chatId, emptyResp.message_id, 30000);
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Send each employee as a separate message with inline buttons
      const newMessageIds: { chat_id: number; message_id: number; scope: string; expires_at: string }[] = [];
      
      for (const employee of employees) {
        const rawName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Unbekannt';
        const employeeName = escapeTelegramHtml(rawName);
        
        // All employees in this list have forwarding enabled (filtered above)
        const messageText = `👤 <b>${employeeName}</b> 🔔`;
        
        console.log(`Sending worker card for ${rawName} to chat ${chatId}`);
        
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: messageText,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "📋 Details",
                    callback_data: `show_details:${employee.id}`
                  },
                  {
                    text: "📝 Notiz",
                    callback_data: `edit_notes:${employee.id}`
                  },
                ],
                [
                  {
                    text: "🔕 Weiterleitung aus",
                    callback_data: `toggle_notify:${employee.id}`
                  }
                ]
              ]
            }
          }),
        });
        
        const result = await response.json();
        if (result.ok && result.result?.message_id) {
          console.log(`Worker card sent for ${rawName}, message_id: ${result.result.message_id}`);
          // Store message ID for cleanup on next /worker command
          newMessageIds.push({
            chat_id: chatId,
            message_id: result.result.message_id,
            scope: "worker_list",
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h expiry
          });
        } else {
          console.error(`Failed to send worker card for ${rawName}:`, result.description || JSON.stringify(result));
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Store new message IDs for future cleanup
      if (newMessageIds.length > 0) {
        const { error: storeErr } = await supabase.from("telegram_message_registry").insert(newMessageIds);
        if (storeErr) {
          console.error("Failed to store worker list message IDs:", storeErr);
        }
      }

      console.log(`Sent ${employees.length} employee cards`);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // Handle /status command
    if (update.message?.text?.startsWith("/status")) {
      const chatId = update.message.chat.id;
      const userMessageId = update.message.message_id;

      // Delete user's command message
      await deleteMessage(TELEGRAM_BOT_TOKEN, chatId, userMessageId);
      
      console.log("Handling /status command");

      // Helper function to check if an email is a custom domain (not Outlook)
      const isCustomDomainEmail = (email: string): boolean => {
        if (!email) return false;
        const lowerEmail = email.toLowerCase();
        return !lowerEmail.includes('@outlook.') && 
               !lowerEmail.includes('@hotmail.') && 
               !lowerEmail.includes('@live.') &&
               !lowerEmail.includes('@msn.');
      };

      // Fetch pending submissions (waiting for demo data)
      const { data: pendingSubmissions, error: pendingError } = await supabase
        .from("task_submissions")
        .select(`
          id,
          status,
          admin_data,
          notes,
          employee_id,
          task_id,
          submitted_at,
          profiles!task_submissions_employee_id_fkey(first_name, last_name),
          tasks!task_submissions_task_id_fkey(title)
        `)
        .eq("status", "pending");

      // Fetch submissions awaiting review
      const { data: reviewSubmissions, error: reviewError } = await supabase
        .from("task_submissions")
        .select(`
          id,
          status,
          admin_data,
          notes,
          employee_id,
          task_id,
          submitted_at,
          profiles!task_submissions_employee_id_fkey(first_name, last_name),
          tasks!task_submissions_task_id_fkey(title)
        `)
        .in("status", ["awaiting_review", "in_review"]);

      if (pendingError || reviewError) {
        console.error("Error fetching submissions:", pendingError || reviewError);
        const errResp = await sendHtmlMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ Fehler beim Laden der Daten.");
        if (errResp?.message_id) {
          scheduleMessageDeletion(TELEGRAM_BOT_TOKEN, chatId, errResp.message_id, 30000);
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Filter pending submissions that are WAITING for demo data
      const waitingForDemoData = pendingSubmissions?.filter(s => {
        const adminData = s.admin_data as Record<string, any> | null;
        const hasDemoData = adminData?.email || 
                           adminData?.phone || 
                           adminData?.generated_email ||
                           adminData?.credentials ||
                           adminData?.login_email ||
                           adminData?.login_password ||
                           adminData?.username;
        return !hasDemoData;
      }) || [];

      // Sort by submission date (oldest first)
      waitingForDemoData.sort((a, b) => 
        new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
      );

      const readyForReview = reviewSubmissions || [];
      readyForReview.sort((a, b) => 
        new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
      );

      // Check if both are empty
      if (waitingForDemoData.length === 0 && readyForReview.length === 0) {
        const okResp = await sendHtmlMessage(TELEGRAM_BOT_TOKEN, chatId, "✅ Keine offenen Aufgaben.\nAlle Demo-Daten ergänzt & keine Prüfungen ausstehend.");
        if (okResp?.message_id) {
          scheduleMessageDeletion(TELEGRAM_BOT_TOKEN, chatId, okResp.message_id, 30000);
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Build status message
      let statusMessage = `📊 <b>Status-Übersicht</b>\n\n`;

      // Section 1: Waiting for demo data
      if (waitingForDemoData.length > 0) {
        statusMessage += `🔄 <b>Warten auf Demo-Daten</b> (${waitingForDemoData.length})\n`;
        statusMessage += `<i>Mitarbeiter warten auf Eingabe:</i>\n\n`;

        for (const submission of waitingForDemoData) {
          const profile = submission.profiles as any;
          const task = submission.tasks as any;
          const adminData = submission.admin_data as Record<string, any> | null;
          
          const rawEmployeeName = profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unbekannt'
            : 'Unbekannt';
          const rawTaskTitle = task?.title || 'Unbekannter Auftrag';
          
          const adminEmail = adminData?.email || adminData?.generated_email;
          const customEmail = adminEmail && isCustomDomainEmail(adminEmail) ? adminEmail : null;
          const adminNotes = submission.notes || adminData?.notes;
          
          const employeeName = escapeTelegramHtml(rawEmployeeName);
          const taskTitle = escapeTelegramHtml(rawTaskTitle);
          
          let taskDisplay = taskTitle;
          if (customEmail) {
            taskDisplay = `${taskTitle} (📧 ${escapeTelegramHtml(customEmail)})`;
          }
          
          const submittedAt = new Date(submission.submitted_at);
          const now = new Date();
          const hoursWaiting = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60));
          const waitingInfo = hoursWaiting < 1 ? '&lt; 1h' : `${hoursWaiting}h`;
          
          statusMessage += `👤 <b>${employeeName}</b>\n`;
          statusMessage += `   📋 ${taskDisplay}\n`;
          statusMessage += `   ⏱️ Wartet seit ${waitingInfo}\n`;
          
          if (adminNotes) {
            statusMessage += `   📝 ${escapeTelegramHtml(adminNotes)}\n`;
          }
          
          statusMessage += `\n`;
        }
      }

      // Section 2: Ready for review
      if (readyForReview.length > 0) {
        if (waitingForDemoData.length > 0) {
          statusMessage += `━━━━━━━━━━━━━━━\n\n`;
        }
        
        statusMessage += `✅ <b>Zur Prüfung bereit</b> (${readyForReview.length})\n`;
        statusMessage += `<i>Aufträge warten auf Admin-Prüfung:</i>\n\n`;

        for (const submission of readyForReview) {
          const profile = submission.profiles as any;
          const task = submission.tasks as any;
          const adminData = submission.admin_data as Record<string, any> | null;
          
          const rawEmployeeName = profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unbekannt'
            : 'Unbekannt';
          const rawTaskTitle = task?.title || 'Unbekannter Auftrag';
          
          const adminEmail = adminData?.email || adminData?.generated_email;
          const customEmail = adminEmail && isCustomDomainEmail(adminEmail) ? adminEmail : null;
          
          const employeeName = escapeTelegramHtml(rawEmployeeName);
          const taskTitle = escapeTelegramHtml(rawTaskTitle);
          
          let taskDisplay = taskTitle;
          if (customEmail) {
            taskDisplay = `${taskTitle} (📧 ${escapeTelegramHtml(customEmail)})`;
          }
          
          const submittedAt = new Date(submission.submitted_at);
          const now = new Date();
          const hoursWaiting = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60));
          const waitingInfo = hoursWaiting < 1 ? '&lt; 1h' : `${hoursWaiting}h`;
          
          statusMessage += `👤 <b>${employeeName}</b>\n`;
          statusMessage += `   📋 ${taskDisplay}\n`;
          statusMessage += `   ⏱️ Eingereicht vor ${waitingInfo}\n`;
          statusMessage += `\n`;
        }
      }

      const statusResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: statusMessage,
          parse_mode: "HTML",
        }),
      });

      const statusResult = await statusResponse.json();
      console.log("Telegram API response for /status:", JSON.stringify(statusResult, null, 2));

      if (!statusResult.ok) {
        console.error("Telegram API error:", statusResult.description);
      } else {
        console.log("Status message sent successfully, message_id:", statusResult.result?.message_id);
        // Schedule auto-delete after 30 seconds
        if (statusResult.result?.message_id) {
          scheduleMessageDeletion(TELEGRAM_BOT_TOKEN, chatId, statusResult.result.message_id, 30000);
        }
      }

      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // Handle callback query (inline button click)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const callbackData = callbackQuery.data;
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      console.log("Callback data:", callbackData);

      // Handle toggle_notify callback
      if (callbackData.startsWith("toggle_notify:")) {
        const userId = callbackData.replace("toggle_notify:", "");
        console.log("Toggling notification for user:", userId);

        // Answer callback
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: "Wird aktualisiert...",
          }),
        });

        // Get current status
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("first_name, last_name, telegram_notifications_enabled")
          .eq("id", userId)
          .single();

        if (profileError || !profile) {
          console.error("Profile not found:", profileError);
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        const currentEnabled = profile.telegram_notifications_enabled !== false;
        const newEnabled = !currentEnabled;

        // Update profile
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ telegram_notifications_enabled: newEnabled })
          .eq("id", userId);

        if (updateError) {
          console.error("Error updating notification setting:", updateError);
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        const rawName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unbekannt';
        const employeeName = escapeTelegramHtml(rawName);
        const statusIcon = newEnabled ? "🔔" : "🔕";
        const messageText = `👤 <b>${employeeName}</b> ${statusIcon}`;

        // Update message with new button state
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: messageText,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "📋 Details",
                    callback_data: `show_details:${userId}`
                  },
                  {
                    text: "📝 Notiz",
                    callback_data: `edit_notes:${userId}`
                  },
                ],
                [
                  {
                    text: newEnabled ? "🔕 Weiterleitung aus" : "🔔 Weiterleitung an",
                    callback_data: `toggle_notify:${userId}`
                  }
                ]
              ]
            }
          }),
        });

        console.log(`Notification setting for ${rawName} changed to: ${newEnabled}`);
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Parse callback data: "show_details:user_id"
      if (callbackData.startsWith("show_details:")) {
        const userId = callbackData.replace("show_details:", "");
        console.log("Showing details for user:", userId);

        // Answer callback to remove loading state
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: "Lade Details...",
          }),
        });

        // Fetch user profile data
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (profileError || !profile) {
          console.error("Profile not found:", profileError);
          await sendTextMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ Profil nicht gefunden.");
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        // Delete any previously stored telegram messages for this user (cleanup old detail views)
        const oldMessageIds = profile.telegram_message_ids as number[] | null;
        if (oldMessageIds && oldMessageIds.length > 0) {
          console.log("Deleting old stored messages:", oldMessageIds);
          for (const oldMsgId of oldMessageIds) {
            try {
              await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, message_id: oldMsgId }),
              });
            } catch (e) {
              console.log(`Failed to delete old message ${oldMsgId}:`, e);
            }
          }
        }

        // Fetch assigned emails
        const { data: emailAccounts } = await supabase
          .from("email_accounts")
          .select("email_address")
          .eq("assigned_to", userId);
        
        const assignedEmails = emailAccounts?.map(e => e.email_address) || [];

        // Fetch generated emails
        const { data: genEmails } = await supabase
          .from("generated_emails")
          .select("full_address")
          .eq("user_id", userId)
          .eq("is_active", true);
        
        const generatedEmails = genEmails?.map(e => e.full_address) || [];

        // Fetch assigned phones
        const { data: phones } = await supabase
          .from("phone_numbers")
          .select("phone_number, service_name")
          .eq("assigned_to", userId);
        
        const assignedPhones = phones?.map(p => 
          p.service_name ? `${p.phone_number} (${p.service_name})` : p.phone_number
        ) || [];

        // Fetch place of birth
        let placeOfBirth = profile.place_of_birth;
        if (!placeOfBirth) {
          const { data: verificationData } = await supabase
            .from("verification_uploads")
            .select("extracted_place_of_birth")
            .eq("user_id", userId)
            .not("extracted_place_of_birth", "is", null)
            .limit(1);
          
          if (verificationData && verificationData.length > 0) {
            placeOfBirth = verificationData[0].extracted_place_of_birth;
          }
        }

        // Fetch tasks with submission IDs, admin_data and notes
        const { data: submissions } = await supabase
          .from("task_submissions")
          .select("id, status, task_id, admin_data, notes, tasks(title)")
          .eq("employee_id", userId);

        // Fetch ALL assigned tasks (even without submission yet)
        const { data: assignedTasks } = await supabase
          .from("tasks")
          .select("id, title")
          .eq("assigned_to", userId);

        // Fetch generated emails for this user's submissions (custom domain emails only, not Outlook)
        const { data: taskEmails } = await supabase
          .from("generated_emails")
          .select("submission_id, full_address")
          .eq("user_id", userId)
          .eq("is_active", true);

        // Create a map of submission_id -> email from generated_emails table
        const submissionEmailMap = new Map<string, string>();
        if (taskEmails) {
          for (const te of taskEmails) {
            if (te.submission_id) {
              submissionEmailMap.set(te.submission_id, te.full_address);
            }
          }
        }

        // Helper function to check if an email is a custom domain (not Outlook)
        const isCustomDomainEmail = (email: string): boolean => {
          if (!email) return false;
          const lowerEmail = email.toLowerCase();
          return !lowerEmail.includes('@outlook.') && 
                 !lowerEmail.includes('@hotmail.') && 
                 !lowerEmail.includes('@live.') &&
                 !lowerEmail.includes('@msn.');
        };

        const pendingTasks: string[] = [];
        const inProgressTasks: string[] = [];
        const awaitingReviewTasks: string[] = [];
        const completedTasks: string[] = [];
        const assignedOnlyTasks: string[] = [];
        const submittedTaskIds = new Set<string>();


        if (submissions) {
          for (const s of submissions) {
            if (s.task_id) submittedTaskIds.add(s.task_id);
            const rawTitle = (s.tasks as any)?.title || "Unbekannt";
            const title = escapeTelegramHtml(rawTitle);
            
            // Check for custom domain email: first from generated_emails, then from admin_data
            let assignedEmail = submissionEmailMap.get(s.id);
            
            // If no email from generated_emails, check admin_data.email
            if (!assignedEmail) {
              const adminData = s.admin_data as Record<string, any> | null;
              const adminEmail = adminData?.email || adminData?.generated_email;
              if (adminEmail && isCustomDomainEmail(adminEmail)) {
                assignedEmail = adminEmail;
              }
            }
            
            // Build task display with email and notes if available
            let taskDisplay = title;
            if (assignedEmail) {
              taskDisplay += ` (📧 ${escapeTelegramHtml(assignedEmail)})`;
            }
            // Show only self-created notes (with timestamp pattern [DD.MM.YYYY])
            if (s.notes) {
              const noteLines = s.notes.split('\n');
              const selfCreatedParts: string[] = [];
              let currentNote = '';
              for (const line of noteLines) {
                if (/^\[[\d]{2}\.[\d]{2}\.[\d]{4}/.test(line.trim())) {
                  if (currentNote) selfCreatedParts.push(currentNote.trim());
                  currentNote = line;
                } else if (currentNote) {
                  currentNote += '\n' + line;
                }
              }
              if (currentNote) selfCreatedParts.push(currentNote.trim());
              
              if (selfCreatedParts.length > 0) {
                const lastNote = selfCreatedParts[selfCreatedParts.length - 1];
                const truncatedNote = lastNote.length > 80 ? lastNote.substring(0, 80) + "..." : lastNote;
                taskDisplay += `\n  📝 <code>${escapeTelegramHtml(truncatedNote)}</code>`;
              }
            }
            
            if (s.status === "pending") {
              pendingTasks.push(taskDisplay);
            } else if (s.status === "in_progress") {
              inProgressTasks.push(taskDisplay);
            } else if (s.status === "awaiting_review" || s.status === "in_review") {
              awaitingReviewTasks.push(taskDisplay);
            } else if (s.status === "completed" || s.status === "approved") {
              completedTasks.push(taskDisplay);
            }
          }
        }

        // Add tasks that are assigned but have no submission yet
        if (assignedTasks) {
          for (const t of assignedTasks) {
            if (!submittedTaskIds.has(t.id)) {
              assignedOnlyTasks.push(escapeTelegramHtml(t.title || "Unbekannt"));
            }
          }
        }

        // Build details caption
        const birthDate = profile.birth_date 
          ? new Date(profile.birth_date).toLocaleDateString('de-DE')
          : 'N/A';
        const birthInfo = placeOfBirth ? `${birthDate}, ${placeOfBirth}` : birthDate;
        
        const employeeName = `${profile.first_name || 'N/A'} ${profile.last_name || 'N/A'}`;
        const addressLine = `${profile.street || 'N/A'}, ${profile.postal_code || ''} ${profile.city || ''}`;
        
        let detailsContent = `👤 <code>${escapeTelegramHtml(employeeName)}</code>`;
        detailsContent += `\n\n📅 ${birthInfo}`;
        detailsContent += `\n📍 <code>${escapeTelegramHtml(addressLine)}</code>`;
        if (profile.alt_street || profile.alt_postal_code || profile.alt_city) {
          const altAddress = `${profile.alt_street || '-'}, ${profile.alt_postal_code || ''} ${profile.alt_city || ''}`;
          detailsContent += `\n📍 Abw.: <code>${escapeTelegramHtml(altAddress)}</code>`;
        }

        if (profile.tax_id) {
          detailsContent += `\n🆔 Steuer-ID: <code>${escapeTelegramHtml(profile.tax_id)}</code>`;
        }

        const allEmails = [...assignedEmails, ...generatedEmails];
        if (allEmails.length > 0) {
          detailsContent += `\n\n📧 E-Mails:\n${allEmails.map(e => `• ${e}`).join('\n')}`;
        }

        if (assignedPhones.length > 0) {
          detailsContent += `\n\n📞 Telefon:\n${assignedPhones.map(p => `• ${p}`).join('\n')}`;
        }

        detailsContent += `\n\n📊 Aufträge:`;
        if (assignedOnlyTasks.length > 0) {
          detailsContent += `\n📌 Zugewiesen:\n${assignedOnlyTasks.map(t => `• ${t}`).join('\n')}`;
        }
        if (pendingTasks.length > 0) {
          detailsContent += `\n🟣 Ausstehend:\n${pendingTasks.map(t => `• ${t}`).join('\n')}`;
        }
        if (inProgressTasks.length > 0) {
          detailsContent += `\n🔄 Laufend:\n${inProgressTasks.map(t => `• ${t}`).join('\n')}`;
        }
        if (awaitingReviewTasks.length > 0) {
          detailsContent += `\n⏳ Zur Prüfung:\n${awaitingReviewTasks.map(t => `• ${t}`).join('\n')}`;
        }
        if (completedTasks.length > 0) {
          detailsContent += `\n✅ Erledigt:\n${completedTasks.map(t => `• ${t}`).join('\n')}`;
        }
        if (assignedOnlyTasks.length === 0 && pendingTasks.length === 0 && inProgressTasks.length === 0 && awaitingReviewTasks.length === 0 && completedTasks.length === 0) {
          detailsContent += `\n• Keine Aufträge`;
        }

        const caption = `${detailsContent}`;

        // Fetch verification documents
        const { data: uploads, error: uploadsError } = await supabase
          .from("verification_uploads")
          .select("id, document_type, file_path, mime_type, base64_content")
          .eq("user_id", userId)
          .order("uploaded_at", { ascending: true });

        if (uploadsError) {
          console.error("Error loading verification documents:", uploadsError);
        }

        const mediaGroup: Array<{ type: string; media: string; caption?: string; parse_mode?: string }> = [];
        const mediaFiles: Array<{ field: string; blob: Blob; filename: string }> = [];

        if (uploads && uploads.length > 0) {
          for (const upload of uploads) {
            let media = "";

            // New scans are stored encrypted in the database. Telegram cannot read
            // data URLs, so attach the decrypted bytes as multipart files.
            if (upload.base64_content) {
              const rawContent = upload.base64_content as string;
              const match = rawContent.match(/^data:([^;]+);base64,(.+)$/s);
              const base64 = match?.[2] ?? rawContent;
              const mimeType = match?.[1] ?? upload.mime_type ?? "image/jpeg";
              try {
                const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
                const field = `scan_${mediaFiles.length}`;
                const extension = mimeType === "image/png" ? "png" : "jpg";
                mediaFiles.push({
                  field,
                  blob: new Blob([bytes], { type: mimeType }),
                  filename: `${upload.document_type || "ausweis"}.${extension}`,
                });
                media = `attach://${field}`;
              } catch (decodeError) {
                console.error(`Error decoding encrypted scan ${upload.id}:`, decodeError);
              }
            }

            // Legacy scans may still exist only in storage.
            if (!media && upload.file_path) {
              for (const bucket of ["verification-documents", "kyc-uploads"]) {
                const { data: signedUrlData } = await supabase.storage
                  .from(bucket)
                  .createSignedUrl(upload.file_path, 3600);
                if (signedUrlData?.signedUrl) {
                  media = signedUrlData.signedUrl;
                  break;
                }
              }
            }

            if (!media) continue;
            mediaGroup.push({
              type: "photo",
              media,
              ...(mediaGroup.length === 0 ? { caption, parse_mode: "HTML" } : {})
            });
          }
        }

        // Delete the original button message
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
          }),
        });

        // Send details with images or just text
        let sentMessageIds: number[] = [];

        if (mediaGroup.length > 0) {
          const mediaBody = new FormData();
          mediaBody.append("chat_id", String(chatId));
          mediaBody.append("media", JSON.stringify(mediaGroup.slice(0, 10)));
          for (const file of mediaFiles.slice(0, 10)) {
            mediaBody.append(file.field, file.blob, file.filename);
          }
          const mediaResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`, {
            method: "POST",
            body: mediaBody,
          });

          const mediaResult = await mediaResponse.json();
          console.log("Media group result:", JSON.stringify(mediaResult, null, 2));

          if (mediaResult.ok && mediaResult.result) {
            sentMessageIds = mediaResult.result.map((msg: any) => msg.message_id);
          }
        } else {
          const textResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: caption,
              parse_mode: "HTML",
            }),
          });

          const textResult = await textResponse.json();
          if (textResult.ok) {
            sentMessageIds = [textResult.result.message_id];
          }
        }

        // Send action buttons as separate message (since mediaGroup doesn't support inline keyboards)
        const actionButtonResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `⚡ <b>Aktionen für ${escapeTelegramHtml(employeeName)}</b>`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "📝 Notiz bearbeiten",
                    callback_data: `edit_notes:${userId}`,
                  },
                  {
                    text: "🔄 Aktualisieren",
                    callback_data: `show_details:${userId}`,
                  },
                ],
              ],
            },
          }),
        });

        const actionResult = await actionButtonResponse.json();
        if (actionResult.ok && actionResult.result?.message_id) {
          sentMessageIds.push(actionResult.result.message_id);
        }

        // Update stored message IDs
        if (sentMessageIds.length > 0) {
          await supabase
            .from("profiles")
            .update({ telegram_message_ids: sentMessageIds })
            .eq("id", userId);

          // Schedule auto-delete after 5 minutes and send button again
          const deleteAfterDelay = async () => {
            await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes
            console.log("Auto-deleting detail messages after 5 minutes...");
            
            // Delete all detail messages
            for (const msgId of sentMessageIds) {
              try {
                await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: chatId, message_id: msgId }),
                });
                console.log(`Deleted message ${msgId}`);
              } catch (e) {
                console.log(`Failed to delete message ${msgId}:`, e);
              }
            }

            // Send new button message so user can open details again
            const buttonMessage = `👤 <b>${employeeName}</b>`;
            const inlineKeyboard = {
              inline_keyboard: [
                [
                  {
                    text: "📋 Details",
                    callback_data: `show_details:${userId}`,
                  },
                  {
                    text: "📝 Notiz",
                    callback_data: `edit_notes:${userId}`,
                  },
                ],
              ],
            };

            const newButtonResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: buttonMessage,
                parse_mode: "HTML",
                reply_markup: inlineKeyboard,
              }),
            });

            const newButtonResult = await newButtonResponse.json();
            if (newButtonResult.ok) {
              // Store new button message ID
              await supabase
                .from("profiles")
                .update({ telegram_message_ids: [newButtonResult.result.message_id] })
                .eq("id", userId);
              console.log("New button message sent:", newButtonResult.result.message_id);
            }
          };

          // Use EdgeRuntime.waitUntil if available, otherwise fire-and-forget
          if (typeof (globalThis as any).EdgeRuntime !== 'undefined') {
            (globalThis as any).EdgeRuntime.waitUntil(deleteAfterDelay());
          } else {
            deleteAfterDelay().catch(console.error);
          }
        }

        console.log("Details sent successfully");
      }

      // Handle chat reply callback (cr: = shortened format)
      if (callbackData.startsWith("cr:") || callbackData.startsWith("chat_reply:")) {
        const parts = callbackData.split(":");
        // Format: cr:shortMsgId:personaTokenOrHr:userToken
        const shortMsgId = parts[1];
        const personaTokenOrHr = parts[2]; // "hr" or token mapped to virtual_employee
        const userToken = parts[3]; // token mapped to profile
        
        console.log("Chat reply request (tokens):", { shortMsgId, personaTokenOrHr, userToken });

        // Answer callback
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: "Bitte Antwort eingeben...",
          }),
        });

        // Resolve full target user ID from mapping table
        const { data: targetMap, error: targetMapError } = await supabase
          .from("telegram_id_map")
          .select("full_id")
          .eq("short_id", userToken)
          .eq("entity", "profile")
          .maybeSingle();
        
        if (targetMapError || !targetMap?.full_id) {
          console.error("Could not resolve target user token:", { userToken, targetMapError });
          await sendHtmlMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ Mitarbeiter nicht gefunden.");
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        const targetUserId = targetMap.full_id;

        const { data: targetProfile, error: targetError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .eq("id", targetUserId)
          .maybeSingle();

        if (targetError || !targetProfile) {
          console.error("Target profile not found after token resolve:", { targetUserId, targetError });
          await sendHtmlMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ Mitarbeiter nicht gefunden.");
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        const targetName = `${targetProfile.first_name || ''} ${targetProfile.last_name || ''}`.trim() || 'Mitarbeiter';

        // Get persona name and full ID
        let personaName = "HR-Team";
        let personaId = "hr";
        
        if (personaTokenOrHr !== "hr") {
          const { data: personaMap, error: personaMapError } = await supabase
            .from("telegram_id_map")
            .select("full_id")
            .eq("short_id", personaTokenOrHr)
            .eq("entity", "virtual_employee")
            .maybeSingle();
          
          if (personaMapError || !personaMap?.full_id) {
            console.error("Could not resolve persona token:", { personaTokenOrHr, personaMapError });
          } else {
            const { data: ve } = await supabase
              .from("virtual_employees")
              .select("id, first_name, last_name")
              .eq("id", personaMap.full_id)
              .maybeSingle();

            if (ve) {
              personaId = ve.id;
              personaName = `${ve.first_name} ${ve.last_name}`;
            }
          }
        }

        // Best-effort: delete mappings after use
        try {
          await supabase
            .from("telegram_id_map")
            .delete()
            .in("short_id", [userToken, personaTokenOrHr]);
        } catch (e) {
          console.error("Failed to cleanup telegram_id_map tokens:", e);
        }

        // Delete the original chat notification message
        await deleteMessage(TELEGRAM_BOT_TOKEN, chatId, messageId);

        // Send force reply prompt
        const promptResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `📝 Antwort für <b>${escapeTelegramHtml(targetName)}</b> als <b>${escapeTelegramHtml(personaName)}</b>:\n\n<i>Antworte auf diese Nachricht mit deinem Text...</i>`,
            parse_mode: "HTML",
            reply_markup: {
              force_reply: true,
              selective: false,
              input_field_placeholder: "Nachricht eingeben..."
            }
          }),
        });

        const promptResult = await promptResponse.json();
        
        if (promptResult.ok && promptResult.result?.message_id) {
          // Store pending reply in database with full IDs
          await supabase
            .from("telegram_pending_replies")
            .insert({
              chat_id: chatId,
              target_user_id: targetUserId,
              persona_id: personaId,
              original_message_id: shortMsgId, // Store short version (just for reference)
              prompt_message_id: promptResult.result.message_id,
              expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
            });
          
          console.log("Pending reply stored, prompt message:", promptResult.result.message_id);
        } else {
          console.error("Failed to send prompt:", promptResult);
        }
        
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Handle cancel_reply callback
      if (callbackData.startsWith("cancel_reply:")) {
        const promptMsgId = parseInt(callbackData.replace("cancel_reply:", ""));
        
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: "Antwort abgebrochen",
          }),
        });

        // Delete the current message
        await deleteMessage(TELEGRAM_BOT_TOKEN, chatId, messageId);
        
        // Delete pending reply from database
        await supabase
          .from("telegram_pending_replies")
          .delete()
          .eq("chat_id", chatId)
          .eq("prompt_message_id", promptMsgId);

        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Handle edit_notes callback - show list of active tasks to select
      if (callbackData.startsWith("edit_notes:")) {
        const userId = callbackData.replace("edit_notes:", "");
        console.log("Edit notes - show task selection for user:", userId);

        // Answer callback
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: "Aufträge laden...",
          }),
        });

        // Get profile info
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", userId)
          .single();

        if (profileError || !profile) {
          await sendHtmlMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ Profil nicht gefunden.");
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        const employeeName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unbekannt';

        // Fetch active tasks (in_progress, pending, awaiting_review) for this user
        const { data: submissions, error: submissionError } = await supabase
          .from("task_submissions")
          .select("id, status, notes, tasks(title)")
          .eq("employee_id", userId)
          .in("status", ["in_progress", "pending", "awaiting_review"]);

        if (submissionError) {
          console.error("Error fetching submissions:", submissionError);
          await sendHtmlMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ Fehler beim Laden der Aufträge.");
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        if (!submissions || submissions.length === 0) {
          // No active tasks - show message
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `📝 <b>Notizen für ${escapeTelegramHtml(employeeName)}</b>\n\n<i>Keine laufenden Aufträge vorhanden.</i>`,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "❌ Schließen",
                      callback_data: `notes_cancel:${userId}`,
                    },
                  ],
                ],
              },
            }),
          });
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        // Build inline keyboard with task buttons (max 10 to fit Telegram limits)
        const taskButtons = submissions.slice(0, 10).map(s => {
          const rawTitle = (s.tasks as any)?.title || "Unbekannt";
          const hasNotes = s.notes ? "📝" : "➕";
          // Truncate title to fit callback data (max 64 bytes)
          const truncatedTitle = rawTitle.length > 20 ? rawTitle.substring(0, 17) + "..." : rawTitle;
          return [{
            text: `${hasNotes} ${truncatedTitle}`,
            callback_data: `task_note:${s.id}`,
          }];
        });

        // Add cancel button
        taskButtons.push([{
          text: "❌ Abbrechen",
          callback_data: `notes_cancel:${userId}`,
        }]);

        // Show task selection
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: `📝 <b>Notiz hinzufügen für ${escapeTelegramHtml(employeeName)}</b>\n\n<b>Wähle einen Auftrag:</b>`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: taskButtons,
            },
          }),
        });

        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Handle task_note callback - show replace/append options for specific task
      if (callbackData.startsWith("task_note:")) {
        const submissionId = callbackData.replace("task_note:", "");
        console.log("Task note options for submission:", submissionId);

        // Answer callback
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: "Notiz-Optionen...",
          }),
        });

        // Get submission with task title and current notes
        const { data: submission, error: subError } = await supabase
          .from("task_submissions")
          .select("id, notes, employee_id, tasks(title)")
          .eq("id", submissionId)
          .single();

        if (subError || !submission) {
          await sendHtmlMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ Auftrag nicht gefunden.");
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        const taskTitle = (submission.tasks as any)?.title || "Unbekannter Auftrag";
        const currentNotes = submission.notes || "(keine Notizen)";
        const truncatedNotes = currentNotes.length > 300 
          ? currentNotes.substring(0, 300) + "..." 
          : currentNotes;

        // Update message to show options
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: `📝 <b>Notizen für: ${escapeTelegramHtml(taskTitle)}</b>\n\n<i>Aktuell:</i>\n${escapeTelegramHtml(truncatedNotes)}\n\n<b>Was möchtest du tun?</b>`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔄 Ersetzen",
                    callback_data: `tasknote_replace:${submissionId}`,
                  },
                  {
                    text: "➕ Anhängen",
                    callback_data: `tasknote_append:${submissionId}`,
                  },
                ],
                [
                  {
                    text: "⬅️ Zurück",
                    callback_data: `edit_notes:${submission.employee_id}`,
                  },
                ],
              ],
            },
          }),
        });

        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Handle tasknote_replace callback
      if (callbackData.startsWith("tasknote_replace:")) {
        const submissionId = callbackData.replace("tasknote_replace:", "");
        console.log("Task note replace mode for submission:", submissionId);

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: "Neue Notiz eingeben...",
          }),
        });

        // Get task title
        const { data: submission } = await supabase
          .from("task_submissions")
          .select("employee_id, tasks(title)")
          .eq("id", submissionId)
          .single();

        const taskTitle = submission ? (submission.tasks as any)?.title || 'Auftrag' : 'Auftrag';

        // Delete the options message
        await deleteMessage(TELEGRAM_BOT_TOKEN, chatId, messageId);

        // Send force reply prompt
        const promptResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `📝 <b>Neue Notiz für: ${escapeTelegramHtml(taskTitle)}</b>\n\n<i>Die alte Notiz wird ersetzt. Antworte auf diese Nachricht...</i>`,
            parse_mode: "HTML",
            reply_markup: {
              force_reply: true,
              selective: false,
              input_field_placeholder: "Neue Notiz eingeben..."
            }
          }),
        });

        const promptResult = await promptResponse.json();
        
        if (promptResult.ok && promptResult.result?.message_id) {
          const promptMsgId = promptResult.result.message_id;
          
          await supabase
            .from("telegram_pending_replies")
            .insert({
              chat_id: chatId,
              target_user_id: submission?.employee_id || "00000000-0000-0000-0000-000000000000",
              persona_id: "tasknote_replace", // Special marker for task notes
              original_message_id: submissionId, // Store submission_id here
              prompt_message_id: promptMsgId,
              expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            });
          
          // Auto-delete prompt after 2 minutes if not replied
          scheduleMessageDeletion(TELEGRAM_BOT_TOKEN, chatId, promptMsgId, 2 * 60 * 1000);
        }

        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Handle tasknote_append callback
      if (callbackData.startsWith("tasknote_append:")) {
        const submissionId = callbackData.replace("tasknote_append:", "");
        console.log("Task note append mode for submission:", submissionId);

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: "Zusätzliche Notiz eingeben...",
          }),
        });

        // Get task title
        const { data: submission } = await supabase
          .from("task_submissions")
          .select("employee_id, tasks(title)")
          .eq("id", submissionId)
          .single();

        const taskTitle = submission ? (submission.tasks as any)?.title || 'Auftrag' : 'Auftrag';

        // Delete the options message
        await deleteMessage(TELEGRAM_BOT_TOKEN, chatId, messageId);

        // Send force reply prompt
        const promptResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `📝 <b>Notiz für ${escapeTelegramHtml(taskTitle)} anhängen</b>\n\n<i>Wird mit Zeitstempel an bestehende Notizen angehängt...</i>`,
            parse_mode: "HTML",
            reply_markup: {
              force_reply: true,
              selective: false,
              input_field_placeholder: "Zusätzliche Notiz..."
            }
          }),
        });

        const promptResult = await promptResponse.json();
        
        if (promptResult.ok && promptResult.result?.message_id) {
          const promptMsgId = promptResult.result.message_id;
          
          await supabase
            .from("telegram_pending_replies")
            .insert({
              chat_id: chatId,
              target_user_id: submission?.employee_id || "00000000-0000-0000-0000-000000000000",
              persona_id: "tasknote_append", // Special marker for task notes append
              original_message_id: submissionId, // Store submission_id here
              prompt_message_id: promptMsgId,
              expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            });
          
          // Auto-delete prompt after 2 minutes if not replied
          scheduleMessageDeletion(TELEGRAM_BOT_TOKEN, chatId, promptMsgId, 2 * 60 * 1000);
        }

        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Old notes_replace and notes_append handlers removed - now using tasknote_* handlers

      // Handle notes_cancel callback
      if (callbackData.startsWith("notes_cancel:")) {
        const userId = callbackData.replace("notes_cancel:", "");

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: "Abgebrochen",
          }),
        });

        // Get profile name
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, telegram_notifications_enabled")
          .eq("id", userId)
          .single();

        const employeeName = profile 
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unbekannt'
          : 'Unbekannt';
        const notifyEnabled = profile?.telegram_notifications_enabled !== false;
        const statusIcon = notifyEnabled ? "🔔" : "🔕";

        // Restore original message with buttons
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: `👤 <b>${escapeTelegramHtml(employeeName)}</b> ${statusIcon}`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "📋 Details",
                    callback_data: `show_details:${userId}`,
                  },
                  {
                    text: "📝 Notiz",
                    callback_data: `edit_notes:${userId}`,
                  },
                ],
              ],
            },
          }),
        });

        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error handling Telegram callback:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendTextMessage(botToken: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
    }),
  });
}

// Send HTML message and return the message_id
async function sendHtmlMessage(botToken: string, chatId: number, text: string): Promise<{ message_id: number } | null> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
      }),
    });
    const result = await response.json();
    if (result.ok) {
      return { message_id: result.result.message_id };
    }
    return null;
  } catch (e) {
    console.error("Error sending HTML message:", e);
    return null;
  }
}

type TelegramDeleteResult = {
  ok: boolean;
  description?: string;
  error_code?: number;
};

async function deleteMessageWithInfo(botToken: string, chatId: number, messageId: number): Promise<TelegramDeleteResult> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    });

    const json = (await res.json().catch(() => null)) as any;
    if (json?.ok) return { ok: true };

    const description = typeof json?.description === "string" ? json.description : "Unknown Telegram error";
    const error_code = typeof json?.error_code === "number" ? json.error_code : undefined;
    console.warn("Telegram deleteMessage API error:", { chatId, messageId, error_code, description });
    return { ok: false, description, error_code };
  } catch (e) {
    console.warn("Failed to call Telegram deleteMessage:", { chatId, messageId, error: String(e) });
    return { ok: false, description: "Network/Runtime error" };
  }
}

// Delete a message
async function deleteMessage(botToken: string, chatId: number, messageId: number): Promise<boolean> {
  const result = await deleteMessageWithInfo(botToken, chatId, messageId);
  return result.ok;
}

// Schedule message deletion after delay
function scheduleMessageDeletion(botToken: string, chatId: number, messageId: number, delayMs: number): void {
  const deleteAfterDelay = async () => {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await deleteMessage(botToken, chatId, messageId);
    console.log(`Auto-deleted message ${messageId} after ${delayMs}ms`);
  };

  // Use EdgeRuntime.waitUntil if available, otherwise fire-and-forget
  if (typeof (globalThis as any).EdgeRuntime !== 'undefined') {
    (globalThis as any).EdgeRuntime.waitUntil(deleteAfterDelay());
  } else {
    deleteAfterDelay().catch(console.error);
  }
}
