import { z } from "zod";

/**
 * Maps technical errors to safe, user-friendly messages.
 * Logs detailed error for debugging while returning safe message for display.
 */
export function handleError(error: unknown): string {
  // Log detailed error for debugging (only in development or server-side)
  console.error("Detailed error:", error);

  // Handle Zod validation errors - these are safe to show
  if (error instanceof z.ZodError) {
    return error.errors[0]?.message || "Please check your input and try again.";
  }

  // Handle error objects with code property (Supabase/Postgres errors)
  if (error && typeof error === "object" && "code" in error) {
    const errorWithCode = error as { code: string; message?: string };
    
    // Postgres constraint violations (23xxx)
    if (errorWithCode.code?.startsWith("23")) {
      if (errorWithCode.code === "23505") {
        return "This record already exists. Please use a unique value.";
      }
      if (errorWithCode.code === "23503") {
        return "Unable to complete operation due to related data constraints.";
      }
      return "Unable to complete operation due to data constraints.";
    }
    
    // PostgREST errors
    if (errorWithCode.code === "PGRST301") {
      return "You do not have permission to perform this action.";
    }
    if (errorWithCode.code === "PGRST116") {
      return "The requested record was not found.";
    }
    if (errorWithCode.code?.startsWith("PGRST")) {
      return "Unable to complete the database operation. Please try again.";
    }

    // Auth errors
    if (errorWithCode.code === "invalid_credentials") {
      return "Invalid email/username or password.";
    }
    if (errorWithCode.code === "email_not_confirmed") {
      return "Please confirm your email before logging in.";
    }
    if (errorWithCode.code === "user_already_exists") {
      return "An account with this email already exists.";
    }
  }

  // Handle string error messages
  if (error && typeof error === "object" && "message" in error) {
    const errorWithMessage = error as { message: string };
    const msg = errorWithMessage.message.toLowerCase();
    
    // Map common error messages to safe equivalents
    if (msg.includes("violates row-level security")) {
      return "You do not have permission to perform this action.";
    }
    if (msg.includes("violates foreign key")) {
      return "Unable to complete operation due to related data.";
    }
    if (msg.includes("duplicate key")) {
      return "This record already exists. Please use a unique value.";
    }
    if (msg.includes("not found") || msg.includes("no rows")) {
      return "The requested record was not found.";
    }
    if (msg.includes("unauthorized") || msg.includes("unauthenticated")) {
      return "Please log in to continue.";
    }
    if (msg.includes("network") || msg.includes("fetch")) {
      return "Network error. Please check your connection and try again.";
    }
    if (msg.includes("timeout")) {
      return "The request timed out. Please try again.";
    }
    if (msg.includes("invalid credentials") || msg.includes("invalid login")) {
      return "Invalid email/username or password.";
    }
  }

  // Generic fallback for unknown errors
  return "An error occurred. Please try again or contact support.";
}

/**
 * Safe error handler for file upload operations
 */
export function handleUploadError(error: unknown): string {
  console.error("Upload error:", error);

  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message: string }).message.toLowerCase();
    
    if (msg.includes("file size") || msg.includes("too large")) {
      return "File is too large. Maximum size is 5MB.";
    }
    if (msg.includes("mime") || msg.includes("type") || msg.includes("not allowed")) {
      return "Invalid file type. Please upload a valid image (JPEG, PNG, GIF, or WebP).";
    }
    if (msg.includes("storage") || msg.includes("bucket")) {
      return "Unable to upload file. Please try again.";
    }
  }

  return "Failed to upload file. Please try again.";
}
