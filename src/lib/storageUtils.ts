import { supabase } from "@/integrations/supabase/client";

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

/**
 * Extracts the file path from a stored URL
 * The URL can be in various formats:
 * - Just the path: "userId/fileId/filename.jpg"
 * - With bucket prefix: "bucket-name/userId/fileId/filename.jpg"
 * - Full URL from getPublicUrl: "https://xxx.supabase.co/storage/v1/object/public/bucket-name/path"
 */
export const extractFilePath = (fileUrl: string, bucketName: string): string => {
  // Handle full Supabase storage URLs
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
  
  // If it contains the bucket prefix, extract the path after it
  if (fileUrl.includes(prefix)) {
    const parts = fileUrl.split(prefix);
    return parts[parts.length - 1];
  }
  
  // If it's already just a path, return as is
  return fileUrl;
};

/**
 * Gets a signed URL for a file in a private bucket
 * @param bucketName - The name of the storage bucket
 * @param fileUrl - The stored file URL/path
 * @param expiresIn - How long the signed URL should be valid (in seconds), default 1 hour
 */
export const getSignedUrl = async (
  bucketName: string,
  fileUrl: string,
  expiresIn: number = 3600
): Promise<string | null> => {
  try {
    const filePath = extractFilePath(fileUrl, bucketName);
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, expiresIn);
    
    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
    
    return data?.signedUrl || null;
  } catch (error) {
    console.error('Error in getSignedUrl:', error);
    return null;
  }
};

/**
 * Gets signed URLs for multiple attachments
 */
export const getSignedUrlsForAttachments = async <T extends { file_url: string }>(
  attachments: T[],
  bucketName: string
): Promise<(T & { signed_url: string })[]> => {
  const results = await Promise.all(
    attachments.map(async (attachment) => {
      const signedUrl = await getSignedUrl(bucketName, attachment.file_url);
      return {
        ...attachment,
        signed_url: signedUrl || attachment.file_url,
      };
    })
  );
  
  return results;
};
