import { supabase } from "@/integrations/supabase/client";
import { getCachedSignedUrl, setCachedSignedUrl } from "./signedUrlCache";

// Map of bucket names and their path prefixes in file_url
const BUCKET_CONFIG: Record<string, string> = {
  'reimbursement-attachments': 'reimbursement-attachments/',
  'review-screenshots': 'review-screenshots/',
  'performance-report-attachments': 'performance-report-attachments/',
  'appeal-attachments': 'appeal-attachments/',
  'violence-incident-attachments': 'violence-incident-attachments/',
  'chat-attachments': 'chat-attachments/',
  'driver-licenses': 'driver-licenses/',
  'medical-cards': 'medical-cards/',
  'profile-avatars': 'profile-avatars/',
};

const DEFAULT_EXPIRES_IN = 3600;

/**
 * Extracts the file path from a stored URL.
 */
export const extractFilePath = (fileUrl: string, bucketName: string): string => {
  if (fileUrl.includes('supabase.co/storage')) {
    const publicPattern = `/object/public/${bucketName}/`;
    const signedPattern = `/object/sign/${bucketName}/`;

    if (fileUrl.includes(publicPattern)) {
      return fileUrl.split(publicPattern)[1]?.split('?')[0] || fileUrl;
    }
    if (fileUrl.includes(signedPattern)) {
      return fileUrl.split(signedPattern)[1]?.split('?')[0] || fileUrl;
    }
  }

  const prefix = BUCKET_CONFIG[bucketName] || `${bucketName}/`;
  if (fileUrl.includes(prefix)) {
    const parts = fileUrl.split(prefix);
    return parts[parts.length - 1];
  }
  return fileUrl;
};

/**
 * Get a single signed URL (cached).
 */
export const getSignedUrl = async (
  bucketName: string,
  fileUrl: string,
  expiresIn: number = DEFAULT_EXPIRES_IN
): Promise<string | null> => {
  try {
    const filePath = extractFilePath(fileUrl, bucketName);
    const cached = getCachedSignedUrl(bucketName, filePath);
    if (cached) return cached;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, expiresIn);

    if (error || !data?.signedUrl) {
      if (error) console.error('Error creating signed URL:', error);
      return null;
    }
    setCachedSignedUrl(bucketName, filePath, data.signedUrl, expiresIn);
    return data.signedUrl;
  } catch (error) {
    console.error('Error in getSignedUrl:', error);
    return null;
  }
};

/**
 * Batch-sign many files in a single request. Returns a map keyed by the
 * original (un-extracted) input path so callers can match results back easily.
 * Uses the cache first; only un-cached paths are requested from Supabase.
 */
export const getSignedUrlsBatch = async (
  bucketName: string,
  fileUrls: string[],
  expiresIn: number = DEFAULT_EXPIRES_IN
): Promise<Map<string, string | null>> => {
  const result = new Map<string, string | null>();
  const toFetch: { original: string; path: string }[] = [];

  for (const original of fileUrls) {
    const path = extractFilePath(original, bucketName);
    const cached = getCachedSignedUrl(bucketName, path);
    if (cached) {
      result.set(original, cached);
    } else {
      toFetch.push({ original, path });
    }
  }

  if (toFetch.length > 0) {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrls(toFetch.map((t) => t.path), expiresIn);

      if (error) {
        console.error("Batch signed URL error:", error);
        for (const t of toFetch) result.set(t.original, null);
      } else {
        const byPath = new Map(
          (data || []).map((d: any) => [d.path, d.signedUrl || null])
        );
        for (const t of toFetch) {
          const signed = (byPath.get(t.path) as string | null) ?? null;
          if (signed) setCachedSignedUrl(bucketName, t.path, signed, expiresIn);
          result.set(t.original, signed);
        }
      }
    } catch (err) {
      console.error("Batch signed URL exception:", err);
      for (const t of toFetch) result.set(t.original, null);
    }
  }

  return result;
};

/**
 * Backwards-compatible helper. Now uses batch signing under the hood.
 */
export const getSignedUrlsForAttachments = async <T extends { file_url: string }>(
  attachments: T[],
  bucketName: string
): Promise<(T & { signed_url: string })[]> => {
  if (attachments.length === 0) return [];
  const urls = await getSignedUrlsBatch(
    bucketName,
    attachments.map((a) => a.file_url)
  );
  return attachments.map((a) => ({
    ...a,
    signed_url: urls.get(a.file_url) || a.file_url,
  }));
};
