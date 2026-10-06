import { supabase } from "@/integrations/supabase/client";

export interface FileUpload {
  id: string;
  file_name: string;
  mime_type: string;
  base64_content: string;
  storage_path: string | null;
  step_id: string;
  uploaded_at: string;
  file_size: number;
}

/**
 * Returns a usable URL for a file upload.
 * Prefers the storage public URL; falls back to base64 data URL for legacy rows.
 */
export function getFileUrl(file: FileUpload): string {
  if (file.storage_path) {
    const { data } = supabase.storage
      .from("task-files")
      .getPublicUrl(file.storage_path);
    return data.publicUrl;
  }
  // Legacy fallback
  if (file.base64_content) {
    return String(file.base64_content).startsWith("data:")
      ? String(file.base64_content)
      : `data:${file.mime_type};base64,${file.base64_content}`;
  }
  return "";
}
