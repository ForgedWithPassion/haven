/**
 * Format a timestamp for display in chat messages
 * @param timestamp - Unix timestamp in milliseconds
 * @param use24Hour - Whether to use 24-hour format (true) or 12-hour format (false)
 * @returns Formatted time string (e.g., "14:30" or "2:30 PM")
 */
export function formatTime(timestamp: number, use24Hour: boolean): string {
  // Use explicit locale to ensure consistent formatting across environments
  const locale = use24Hour ? "en-GB" : "en-US";
  return new Date(timestamp).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: !use24Hour,
  });
}
