// In-memory cache for Supabase storage signed URLs.
// Avoids re-signing the same file repeatedly within a tab session.

type CacheEntry = { url: string; expiresAt: number };

const cache = new Map<string, CacheEntry>();

// Treat URLs as expired 5 minutes before actual expiry to be safe.
const SAFETY_MARGIN_MS = 5 * 60 * 1000;

const keyOf = (bucket: string, path: string) => `${bucket}:${path}`;

export const getCachedSignedUrl = (bucket: string, path: string): string | null => {
  const entry = cache.get(keyOf(bucket, path));
  if (!entry) return null;
  if (Date.now() + SAFETY_MARGIN_MS >= entry.expiresAt) {
    cache.delete(keyOf(bucket, path));
    return null;
  }
  return entry.url;
};

export const setCachedSignedUrl = (
  bucket: string,
  path: string,
  url: string,
  expiresInSeconds: number
) => {
  cache.set(keyOf(bucket, path), {
    url,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  });
};

export const clearSignedUrlCache = () => cache.clear();
