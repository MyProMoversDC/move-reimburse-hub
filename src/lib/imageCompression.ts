// Client-side image preprocessing for fast chat uploads.
// - Converts HEIC (iPhone) to JPEG so we can compress it.
// - Aggressively compresses images > 500 KB.
// - Prefers WebP output when supported (~25-35% smaller than JPEG at same quality).
// - Skips GIFs (would lose animation).

const COMPRESS_THRESHOLD_BYTES = 500 * 1024; // 500 KB
const FULL_MAX_EDGE = 1400;
const FULL_QUALITY = 0.75;
const THUMB_MAX_EDGE = 400;
const THUMB_QUALITY = 0.7;

let _webpSupported: boolean | null = null;
const supportsWebP = (): boolean => {
  if (_webpSupported !== null) return _webpSupported;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    _webpSupported = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    _webpSupported = false;
  }
  return _webpSupported;
};

const loadImage = (file: File | Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });

const drawToBlob = (
  img: HTMLImageElement,
  maxEdge: number,
  quality: number,
  mime: string
): Promise<Blob | null> => {
  const ratio = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, quality));
};

const isHeic = (file: File): boolean => {
  const t = (file.type || "").toLowerCase();
  if (t === "image/heic" || t === "image/heif") return true;
  const name = (file.name || "").toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
};

/** Converts HEIC/HEIF to JPEG using a lazy-loaded library. Returns original on failure. */
const convertHeicIfNeeded = async (file: File): Promise<File> => {
  if (!isHeic(file)) return file;
  try {
    const mod = await import("heic2any");
    const converted = (await mod.default({
      blob: file,
      toType: "image/jpeg",
      quality: 0.85,
    })) as Blob;
    return new File([converted], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (e) {
    console.warn("HEIC conversion failed, using original:", e);
    return file;
  }
};

export const shouldCompressImage = (file: File) =>
  file.type.startsWith("image/") &&
  file.type !== "image/gif" &&
  file.size > COMPRESS_THRESHOLD_BYTES;

export interface CompressionStats {
  originalSize: number;
  outputSize: number;
  durationMs: number;
  converted: boolean;
}

/**
 * Returns a compressed version of the image (WebP if supported, else JPEG),
 * or the original file if compression is not beneficial / not applicable.
 * Also handles HEIC → JPEG conversion.
 */
export const compressImage = async (
  file: File,
  onStats?: (s: CompressionStats) => void
): Promise<File> => {
  const start = performance.now();
  const originalSize = file.size;

  // HEIC always needs conversion (browsers can't render it)
  const working = await convertHeicIfNeeded(file);

  if (!shouldCompressImage(working)) {
    onStats?.({
      originalSize,
      outputSize: working.size,
      durationMs: performance.now() - start,
      converted: working !== file,
    });
    return working;
  }

  try {
    const img = await loadImage(working);
    const mime = supportsWebP() ? "image/webp" : "image/jpeg";
    const ext = mime === "image/webp" ? ".webp" : ".jpg";
    const blob = await drawToBlob(img, FULL_MAX_EDGE, FULL_QUALITY, mime);
    if (!blob || blob.size >= working.size) {
      onStats?.({
        originalSize,
        outputSize: working.size,
        durationMs: performance.now() - start,
        converted: working !== file,
      });
      return working;
    }
    const out = new File([blob], working.name.replace(/\.[^.]+$/, ext), {
      type: mime,
      lastModified: Date.now(),
    });
    onStats?.({
      originalSize,
      outputSize: out.size,
      durationMs: performance.now() - start,
      converted: true,
    });
    return out;
  } catch (e) {
    console.warn("Image compression failed, using original:", e);
    onStats?.({
      originalSize,
      outputSize: working.size,
      durationMs: performance.now() - start,
      converted: working !== file,
    });
    return working;
  }
};

/** Returns a small JPEG thumbnail for an image file, or null if it cannot be made. */
export const makeThumbnail = async (file: File): Promise<Blob | null> => {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return null;
  try {
    const img = await loadImage(file);
    return await drawToBlob(img, THUMB_MAX_EDGE, THUMB_QUALITY, "image/jpeg");
  } catch (e) {
    console.warn("Thumbnail generation failed:", e);
    return null;
  }
};
