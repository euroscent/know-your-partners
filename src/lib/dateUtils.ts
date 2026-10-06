/**
 * Formats an ISO date string (YYYY-MM-DD) to German display format (DD.MM.YYYY)
 * This function parses the date parts directly to avoid timezone issues
 * that occur with new Date() parsing of ISO date strings.
 * 
 * @param dateString - The date string in YYYY-MM-DD format
 * @returns The formatted date string in German format (DD.MM.YYYY) or null if invalid
 */
export function formatDateToGerman(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  
  // Handle YYYY-MM-DD format (ISO)
  const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2]; // Keep leading zero
    const day = isoMatch[3]; // Keep leading zero
    return `${day}.${month}.${year}`;
  }
  
  // If already in German format (D.M.YYYY or DD.MM.YYYY), normalize to DD.MM.YYYY
  const germanMatch = dateString.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (germanMatch) {
    const day = germanMatch[1].padStart(2, '0');
    const month = germanMatch[2].padStart(2, '0');
    const year = germanMatch[3];
    return `${day}.${month}.${year}`;
  }
  
  return dateString;
}

/**
 * Adjusts a date to the next weekday if it falls on a weekend.
 * If the date is Saturday, it moves to Friday.
 * If the date is Sunday, it moves to Monday.
 * 
 * @param date - The date to adjust
 * @returns The adjusted date (always a weekday)
 */
export function adjustToWeekday(date: Date): Date {
  const dayOfWeek = date.getDay();
  const adjustedDate = new Date(date);
  
  if (dayOfWeek === 0) {
    // Sunday -> move to next day (Monday)
    adjustedDate.setDate(adjustedDate.getDate() + 1);
  } else if (dayOfWeek === 6) {
    // Saturday -> move to previous day (Friday)
    adjustedDate.setDate(adjustedDate.getDate() - 1);
  }
  
  return adjustedDate;
}

/**
 * Formats a date string to YYYY-MM-DD and ensures it's a weekday
 * @param dateString - The date string to adjust
 * @returns The adjusted date in YYYY-MM-DD format
 */
export function adjustToWeekdayString(dateString: string): string {
  const date = new Date(dateString);
  const adjusted = adjustToWeekday(date);
  return adjusted.toISOString().split('T')[0];
}
