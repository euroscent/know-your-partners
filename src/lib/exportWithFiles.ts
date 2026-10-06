import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";

type ExportPayload = {
  storage_urls?: Record<string, string>;
  storage_files?: Record<string, { base64: string; contentType: string }>;
  summary?: Record<string, number>;
  [key: string]: unknown;
};

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const base64ToUint8 = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/**
 * Loads the project export and downloads every referenced storage file
 * (images, attachments) in the browser — no edge-function memory limits, and
 * the result stays usable after the signed links expire.
 */
export async function fetchExportWithFiles(
  onProgress?: (done: number, total: number) => void,
): Promise<{ payload: ExportPayload; embedded: number; failed: string[] }> {
  const { data, error } = await supabase.functions.invoke("export-project-data", {
    method: "GET",
  });
  if (error) throw error;

  const payload = (data || {}) as ExportPayload;
  const urls = payload.storage_urls || {};
  const entries = Object.entries(urls);
  const files: Record<string, { base64: string; contentType: string }> = {
    ...(payload.storage_files || {}),
  };
  const failed: string[] = [];

  let done = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < entries.length) {
      const index = cursor++;
      const [path, url] = entries[index];
      if (!files[path]) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          files[path] = {
            base64: toBase64(await blob.arrayBuffer()),
            contentType: blob.type || "application/octet-stream",
          };
        } catch {
          failed.push(path);
        }
      }
      done++;
      onProgress?.(done, entries.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(5, entries.length) }, worker));

  payload.storage_files = files;
  payload.summary = {
    ...(payload.summary || {}),
    storage_files: Object.keys(files).length,
  };

  return { payload, embedded: Object.keys(files).length, failed };
}

/**
 * Packs an export payload into a ZIP: data.json (without base64 blobs) plus the
 * real image/attachment files under files/<bucket>/<path>.
 */
export async function buildExportZip(payload: ExportPayload): Promise<Blob> {
  const zip = new JSZip();
  const files = payload.storage_files || {};
  const contentTypes: Record<string, string> = {};

  const filesFolder = zip.folder("files")!;
  for (const [path, file] of Object.entries(files)) {
    filesFolder.file(path, base64ToUint8(file.base64));
    contentTypes[path] = file.contentType;
  }

  const meta = { ...payload, storage_files: {}, storage_file_types: contentTypes };
  zip.file("data.json", JSON.stringify(meta, null, 2));

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

/** Reads a previously exported .zip (or plain .json) back into an import payload. */
export async function readExportFile(file: File): Promise<ExportPayload> {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return JSON.parse(await file.text());
  }

  const zip = await JSZip.loadAsync(file);
  const dataEntry = zip.file("data.json");
  if (!dataEntry) throw new Error("data.json fehlt im ZIP");
  const payload = JSON.parse(await dataEntry.async("string")) as ExportPayload & {
    storage_file_types?: Record<string, string>;
  };

  const storageFiles: Record<string, { base64: string; contentType: string }> = {};
  const types = payload.storage_file_types || {};
  const entries: JSZip.JSZipObject[] = [];
  zip.folder("files")?.forEach((_relPath, entry) => {
    if (!entry.dir) entries.push(entry);
  });

  for (const entry of entries) {
    const path = entry.name.replace(/^files\//, "");
    storageFiles[path] = {
      base64: await entry.async("base64"),
      contentType: types[path] || "application/octet-stream",
    };
  }

  payload.storage_files = storageFiles;
  delete payload.storage_file_types;
  return payload;
}
