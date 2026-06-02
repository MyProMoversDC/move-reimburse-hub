// Client-side image compression for fast chat uploads.
// Skips GIFs (would lose animation) and small files.

const COMPRESS_THRESHOLD_BYTES = 1.5 * 1024 * 1024; // 1.5 MB
const FULL_MAX_EDGE = 1920;
const FULL_QUALITY = 0.82;
const THUMB_MAX_EDGE = 400;
const THUMB_QUALITY = 0.7;

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
  quality: number
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
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
};

export const shouldCompressImage = (file: File) =>
  file.type.startsWith("image/") &&
  file.type !== "image/gif" &&
  file.size > COMPRESS_THRESHOLD_BYTES;

/**
 * Returns a compressed JPEG version of the image, or the original file if
 * compression is not beneficial / not applicable.
 */
export const compressImage = async (file: File): Promise<File> => {
  if (!shouldCompressImage(file)) return file;
  try {
    const img = await loadImage(file);
    const blob = await drawToBlob(img, FULL_MAX_EDGE, FULL_QUALITY);
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (e) {
    console.warn("Image compression failed, using original:", e);
    return file;
  }
};

/**
 * Returns a small JPEG thumbnail for an image file, or null if it cannot be made.
 */
export const makeThumbnail = async (file: File): Promise<Blob | null> => {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return null;
  try {
    const img = await loadImage(file);
    return await drawToBlob(img, THUMB_MAX_EDGE, THUMB_QUALITY);
  } catch (e) {
    console.warn("Thumbnail generation failed:", e);
    return null;
  }
};
