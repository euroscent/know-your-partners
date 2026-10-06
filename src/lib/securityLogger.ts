import { supabase } from "@/integrations/supabase/client";

type SecurityEventType =
  | "login_success"
  | "login_failure"
  | "password_reset"
  | "signup"
  | "admin_action"
  | "admin_login"
  | "suspicious_activity"
  | "logout"
  | "session_created"
  | "profile_update"
  | "settings_change"
  | "data_export"
  | "file_upload"
  | "file_download"
  | "permission_change"
  | "password_change"
  | "account_lockout"
  | "mfa_attempt";

interface LogSecurityEventParams {
  event_type: SecurityEventType;
  severity?: "info" | "warning" | "critical";
  email?: string;
  user_id?: string;
  metadata?: Record<string, any>;
}

export async function logSecurityEvent(params: LogSecurityEventParams) {
  try {
    await supabase.functions.invoke("log-security-event", {
      body: params,
    });
  } catch (err) {
    console.error("[SecurityLogger] Failed to log event:", err);
  }
}

export function logProfileUpdate(userId: string, email: string, changedFields: string[]) {
  return logSecurityEvent({
    event_type: "profile_update",
    severity: "info",
    user_id: userId,
    email,
    metadata: { changed_fields: changedFields },
  });
}

export function logSettingsChange(userId: string, email: string, setting: string, oldValue?: string) {
  return logSecurityEvent({
    event_type: "settings_change",
    severity: "info",
    user_id: userId,
    email,
    metadata: { setting, old_value: oldValue ? "***" : undefined },
  });
}

export function logDataExport(userId: string, email: string, exportType: string, recordCount?: number) {
  return logSecurityEvent({
    event_type: "data_export",
    severity: "warning",
    user_id: userId,
    email,
    metadata: { export_type: exportType, record_count: recordCount },
  });
}

export function logFileUpload(userId: string, email: string, fileName: string, bucket: string) {
  return logSecurityEvent({
    event_type: "file_upload",
    severity: "info",
    user_id: userId,
    email,
    metadata: { file_name: fileName, bucket },
  });
}

export function logFileDownload(userId: string, email: string, fileName: string) {
  return logSecurityEvent({
    event_type: "file_download",
    severity: "info",
    user_id: userId,
    email,
    metadata: { file_name: fileName },
  });
}

export function logPermissionChange(
  adminId: string,
  adminEmail: string,
  targetUserId: string,
  action: string,
  role: string
) {
  return logSecurityEvent({
    event_type: "permission_change",
    severity: "critical",
    user_id: adminId,
    email: adminEmail,
    metadata: { target_user_id: targetUserId, action, role },
  });
}

export function logPasswordChange(userId: string, email: string) {
  return logSecurityEvent({
    event_type: "password_change",
    severity: "warning",
    user_id: userId,
    email,
  });
}

export function logAdminAction(
  adminId: string,
  email: string,
  action: string,
  target: string,
  details?: Record<string, any>
) {
  return logSecurityEvent({
    event_type: "admin_action",
    severity: "info",
    user_id: adminId,
    email,
    metadata: { action, target, ...details },
  });
}
