import { format as dateFnsFormat } from "date-fns";
import { toZonedTime, format as formatTz } from "date-fns-tz";

const EST_TIMEZONE = "America/New_York";

/**
 * Formats a date to EST timezone with the given format string
 * @param date - Date string or Date object
 * @param formatStr - date-fns format string
 * @returns Formatted date string in EST
 */
export const formatInEST = (date: string | Date, formatStr: string = "MM/dd/yyyy HH:mm"): string => {
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const estDate = toZonedTime(dateObj, EST_TIMEZONE);
    return formatTz(estDate, formatStr, { timeZone: EST_TIMEZONE });
  } catch (error) {
    console.error("Error formatting date to EST:", error);
    return dateFnsFormat(new Date(date), formatStr);
  }
};

/**
 * Formats a date to EST with date only (no time)
 */
export const formatDateEST = (date: string | Date): string => {
  return formatInEST(date, "MM/dd/yyyy");
};

/**
 * Formats a date to EST with date and time
 */
export const formatDateTimeEST = (date: string | Date): string => {
  return formatInEST(date, "MM/dd/yyyy HH:mm");
};

/**
 * Formats a date with EST suffix for clarity
 */
export const formatDateTimeWithEST = (date: string | Date): string => {
  return `${formatInEST(date, "MM/dd/yyyy HH:mm")} EST`;
};
