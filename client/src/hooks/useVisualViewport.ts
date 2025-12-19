import { useEffect } from "react";

/**
 * Hook to handle mobile keyboard visibility by adjusting CSS custom property
 * This enables the chat input to stay pinned above the keyboard
 */
export function useVisualViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      // Calculate the keyboard height by comparing visual viewport to window
      const keyboardHeight = window.innerHeight - viewport.height;
      // Set CSS variable for keyboard offset
      document.documentElement.style.setProperty(
        "--keyboard-height",
        `${Math.max(0, keyboardHeight)}px`,
      );
      // Also set the viewport offset for scroll positioning
      document.documentElement.style.setProperty(
        "--viewport-offset",
        `${viewport.offsetTop}px`,
      );
    };

    // Initial calculation
    handleResize();

    viewport.addEventListener("resize", handleResize);
    viewport.addEventListener("scroll", handleResize);

    return () => {
      viewport.removeEventListener("resize", handleResize);
      viewport.removeEventListener("scroll", handleResize);
      document.documentElement.style.removeProperty("--keyboard-height");
      document.documentElement.style.removeProperty("--viewport-offset");
    };
  }, []);
}
