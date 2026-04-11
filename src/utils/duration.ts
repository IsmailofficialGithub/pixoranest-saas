/**
 * Parses a duration string or number into total seconds.
 * format example: 0.00:40.00
 * Handles formats: 
 * - HH:MM:SS (e.g., "01:23:45")
 * - MM:SS (e.g., "05:30")
 * - D.HH:MM:SS (e.g., "1.02:30:00" for 1 day, 2 hours, 30 mins)
 * - PostgreSQL Interval format (e.g., "0.00:01:55.77")
 * - Numeric seconds as string or number
 */
export function parseDuration(val: any): number {
  if (typeof val === 'number') return val;
  if (!val || typeof val !== 'string') return 0;

  const str = val.trim();
  if (!str) return 0;

  // Handle formats with colons (HH:MM:SS, MM:SS, etc.)
  if (str.includes(':')) {
    const parts = str.split(':');

    // HH:MM:SS or D.HH:MM:SS
    if (parts.length === 3) {
      let hours = 0;
      // Check for Day.Hour format in the first part (e.g., "1.02:00:00")
      if (parts[0].includes('.')) {
        const hParts = parts[0].split('.');
        // PostgreSQL interval can be "0.00:01:55" where 0 is days, 00 is hours
        hours = (parseFloat(hParts[0]) || 0) * 24 + (parseFloat(hParts[1]) || 0);
      } else {
        hours = parseFloat(parts[0]) || 0;
      }
      const minutes = parseFloat(parts[1]) || 0;
      const seconds = parseFloat(parts[2]) || 0;
      return (hours * 3600) + (minutes * 60) + seconds;
    }

    // MM:SS
    if (parts.length === 2) {
      const minutes = parseFloat(parts[0]) || 0;
      const seconds = parseFloat(parts[1]) || 0;
      return (minutes * 60) + seconds;
    }
  }

  // Fallback to numeric parsing (if it's just "115" or "115.5")
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formats seconds into a human-readable string: "1h 2m 3s", "4m 5s", or "6s"
 */
export function formatDuration(val: any): string {
  const seconds = parseDuration(val);
  if (seconds <= 0) return "0s";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const chunks: string[] = [];
  if (h > 0) chunks.push(`${h}h`);
  if (m > 0) chunks.push(`${m}m`);

  // Show seconds if minutes/hours are small, or if there's a remainder
  // "1m 0s" -> "1m 0s" is clearer for calls
  if (h > 0 || m > 0) {
    chunks.push(`${s}s`);
  } else {
    chunks.push(`${s}s`);
  }

  // Clean up: join with space
  return chunks.join(' ') || "0s";
}

/**
 * Alias for compatibility with legacy parseDurationToSeconds calls
 */
export const parseDurationToSeconds = parseDuration;
