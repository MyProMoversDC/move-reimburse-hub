import JSZip from "jszip";
import { runWithConcurrency } from "./uploadQueue";

export interface DownloadItem {
  url: string;
  fileName: string;
}

const sanitize = (name: string) => name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 180) || "file";

/**
 * Fetch multiple files in parallel and bundle them into a single .zip download.
 * Uses concurrency=6 so even slow connections still progress quickly.
 */
export async function downloadFilesAsZip(
  items: DownloadItem[],
  zipName = "chat-media.zip",
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  if (items.length === 0) return;

  const zip = new JSZip();
  const used = new Map<string, number>();
  let done = 0;

  await runWithConcurrency(items, 6, async (item) => {
    try {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();

      let name = sanitize(item.fileName);
      const count = used.get(name) || 0;
      if (count > 0) {
        const dot = name.lastIndexOf(".");
        name = dot > 0
          ? `${name.slice(0, dot)} (${count})${name.slice(dot)}`
          : `${name} (${count})`;
      }
      used.set(sanitize(item.fileName), count + 1);

      zip.file(name, blob);
    } catch (err) {
      console.error("[bulkDownload] failed:", item.fileName, err);
    } finally {
      done += 1;
      onProgress?.(done, items.length);
    }
  });

  const content = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
