/**
 * Utility functions for task-related operations
 * Centralizes common logic used across Dashboard and Tasks pages
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Determines the glow/border styles for a task card based on its submission status
 */
export const getTaskGlowStyles = (options: {
  isRejected?: boolean;
  isInReview?: boolean;
  hasDemoData?: boolean;
  isCompleted?: boolean;
}): string => {
  const { isRejected, isInReview, hasDemoData, isCompleted } = options;

  if (isRejected) {
    return "border-l-4 border-l-red-500 border border-red-500/60 bg-red-500/15 shadow-[0_0_40px_5px_rgba(239,68,68,0.45),0_4px_20px_rgba(239,68,68,0.25)] hover:shadow-[0_0_55px_8px_rgba(239,68,68,0.6),0_8px_30px_rgba(239,68,68,0.35)] hover:border-red-500/80 hover:bg-red-500/25";
  }
  if (isInReview) {
    return "border-l-4 border-l-yellow-500 border border-yellow-500/60 bg-yellow-500/15 shadow-[0_0_40px_5px_rgba(234,179,8,0.45),0_4px_20px_rgba(234,179,8,0.25)] hover:shadow-[0_0_55px_8px_rgba(234,179,8,0.6),0_8px_30px_rgba(234,179,8,0.35)] hover:border-yellow-500/80 hover:bg-yellow-500/25";
  }
  if (hasDemoData) {
    return "border-l-4 border-l-green-500 border border-green-500/60 bg-green-500/15 shadow-[0_0_40px_5px_rgba(34,197,94,0.45),0_4px_20px_rgba(34,197,94,0.25)] hover:shadow-[0_0_55px_8px_rgba(34,197,94,0.6),0_8px_30px_rgba(34,197,94,0.35)] hover:border-green-500/80 hover:bg-green-500/25";
  }
  if (isCompleted) {
    return "border-l-4 border-l-blue-500 border border-blue-500/60 bg-blue-500/15 shadow-[0_0_40px_5px_rgba(59,130,246,0.45),0_4px_20px_rgba(59,130,246,0.25)] hover:shadow-[0_0_55px_8px_rgba(59,130,246,0.6),0_8px_30px_rgba(59,130,246,0.35)] hover:border-blue-500/80 hover:bg-blue-500/25";
  }
  // Default: purple for new/in-progress tasks
  return "border-l-4 border-l-purple-500 border border-purple-500/50 bg-purple-500/15 shadow-[0_0_40px_5px_rgba(168,85,247,0.4),0_4px_20px_rgba(168,85,247,0.2)] hover:shadow-[0_0_55px_8px_rgba(168,85,247,0.55),0_8px_30px_rgba(168,85,247,0.3)] hover:border-purple-500/70 hover:bg-purple-500/25";

};

/**
 * Extracts storage object path from a Supabase storage URL
 */
export const extractTaskFilesPath = (url: string): string | null => {
  try {
    const marker = "/storage/v1/object/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    const after = url.slice(idx + marker.length);
    const parts = after.split("/");
    if (parts.length < 3) return null;
    const bucket = parts[1];
    if (bucket !== "task-files") return null;
    return parts.slice(2).join("/");
  } catch {
    return null;
  }
};

/**
 * Normalizes images array from task data
 */
export const normalizeImages = (images: unknown): string[] => {
  if (!Array.isArray(images)) return [];
  return images.filter((img: unknown): img is string => typeof img === "string" && img.length > 0);
};

/**
 * Generates signed banner URLs for a task
 */
/**
 * Generates signed banner URLs for a task with cache-busting
 * @param task - Task object with image fields
 * @param cacheBuster - Optional cache-busting string (e.g., updated_at timestamp)
 */
export const getBannerUrls = async (task: {
  image_url?: string | null;
  images?: unknown;
  logo_url?: string | null;
  client?: { logo_url?: string | null } | null;
  updated_at?: string | null;
}, cacheBuster?: string): Promise<string[]> => {
  const imagesArray = normalizeImages(task.images);

  // Only use explicit banner images (images[] array).
  // logo_url and client.logo_url are branding, not banners – don't rotate them.
  // image_url is treated as a fallback only when images[] is empty.
  const candidates =
    imagesArray.length > 0
      ? imagesArray
      : task.image_url
        ? [task.image_url]
        : [];

  // Filter out placeholder images
  const filtered = candidates
    .filter((u): u is string => typeof u === "string" && u.length > 0)
    .filter((u) => !u.includes("placeholder"));

  // de-dupe while keeping order
  const unique = Array.from(new Set(filtered));

  // Use task's updated_at or provided cacheBuster for cache invalidation
  const cacheKey = cacheBuster || task.updated_at || Date.now().toString();

  const signed = await Promise.all(
    unique.map(async (candidate) => {
      const objectPath = extractTaskFilesPath(candidate);
      if (!objectPath) {
        // For external URLs, append cache-buster
        const separator = candidate.includes("?") ? "&" : "?";
        return `${candidate}${separator}_v=${encodeURIComponent(cacheKey)}`;
      }

      const { data, error } = await supabase.storage
        .from("task-files")
        .createSignedUrl(objectPath, 60 * 60);

      if (error || !data?.signedUrl) {
        // Fallback with cache-buster
        const separator = candidate.includes("?") ? "&" : "?";
        return `${candidate}${separator}_v=${encodeURIComponent(cacheKey)}`;
      }
      
      // Append cache-buster to signed URL as well
      return `${data.signedUrl}&_v=${encodeURIComponent(cacheKey)}`;
    })
  );

  return signed.filter(Boolean);
};

/**
 * Checks if admin_data contains demo data
 */
export const hasDemoDataInAdminData = (adminData: Record<string, unknown> | null | undefined, status?: string): boolean => {
  if (!adminData) return false;
  const identCodes = adminData.ident_codes;
  const hasIdentCodes = Array.isArray(identCodes) && identCodes.some((c) => typeof c === "string" && c.trim().length > 0);
  return !!(
    adminData.demo_data ||
    adminData.demo_data_provided ||
    adminData.demo_data_requested_at ||
    adminData.phone ||
    adminData.email ||
    (typeof adminData.ident_code === "string" && adminData.ident_code.trim().length > 0) ||
    hasIdentCodes ||
    (typeof adminData.info_text === "string" && adminData.info_text.trim().length > 0) ||
    status === "kyc_completed"
  );
};
