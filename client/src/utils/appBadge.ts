// App badge utilities for document title, favicon, and PWA badge

// Cache the original favicon state
let originalFaviconHref: string | null = null;
let faviconLinkElement: HTMLLinkElement | null = null;

/**
 * Updates the document title with unread count
 * Format: "(5) Haven" when count > 0, "Haven" when 0
 */
export function setDocumentTitle(unreadCount: number): void {
  const baseTitle = "Haven";
  document.title =
    unreadCount > 0 ? `(${unreadCount}) ${baseTitle}` : baseTitle;
}

/**
 * Creates a favicon with a badge overlay using canvas
 * Returns a data URL for the new favicon
 */
export function createBadgedFavicon(
  originalImage: HTMLImageElement,
  count: number,
): string {
  const canvas = document.createElement("canvas");
  const size = 32; // Standard favicon size
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return originalImage.src;
  }

  // Draw original favicon
  ctx.drawImage(originalImage, 0, 0, size, size);

  if (count > 0) {
    // Draw badge circle in bottom-right corner
    const badgeRadius = 8;
    const badgeX = size - badgeRadius - 1;
    const badgeY = size - badgeRadius - 1;

    // Red circle background
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#e53935"; // Material red
    ctx.fill();

    // White text
    ctx.fillStyle = "white";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const displayCount = count > 99 ? "99+" : String(count);
    ctx.fillText(displayCount, badgeX, badgeY);
  }

  return canvas.toDataURL("image/png");
}

/**
 * Updates the favicon with an unread badge
 * Caches the original favicon for restoration
 */
export function setFaviconBadge(count: number): void {
  // Find the favicon link element (prefer PNG for canvas operations)
  if (!faviconLinkElement) {
    faviconLinkElement =
      document.querySelector<HTMLLinkElement>(
        'link[rel="icon"][type="image/png"]',
      ) || document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  }

  if (!faviconLinkElement) return;

  // Cache original on first call
  if (originalFaviconHref === null) {
    originalFaviconHref = faviconLinkElement.href;
  }

  if (count === 0) {
    // Restore original
    faviconLinkElement.href = originalFaviconHref;
    return;
  }

  // Load original image and create badged version
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    if (faviconLinkElement) {
      const badgedDataUrl = createBadgedFavicon(img, count);
      faviconLinkElement.href = badgedDataUrl;
    }
  };
  img.onerror = () => {
    // If loading fails, just use original
    console.debug("Failed to load favicon for badge");
  };
  img.src = originalFaviconHref;
}

/**
 * Check if PWA badge API is supported
 */
export function supportsPWABadge(): boolean {
  return "setAppBadge" in navigator;
}

/**
 * Sets the PWA app badge using the Badging API
 * Uses feature detection - silently fails if not supported
 */
export function setPWABadge(count: number): void {
  if (!supportsPWABadge()) return;

  try {
    if (count > 0) {
      (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> })
        .setAppBadge(count)
        .catch(() => {
          // Silently ignore - PWA badge is a progressive enhancement
        });
    } else {
      (navigator as Navigator & { clearAppBadge: () => Promise<void> })
        .clearAppBadge()
        .catch(() => {
          // Silently ignore
        });
    }
  } catch {
    // Silently fail - PWA badge is a progressive enhancement
  }
}

/**
 * Convenience function to update all badge indicators at once
 */
export function updateAllBadges(count: number): void {
  setDocumentTitle(count);
  setFaviconBadge(count);
  setPWABadge(count);
}

/**
 * Reset all badge state (for cleanup)
 */
export function resetBadges(): void {
  updateAllBadges(0);
}
