export interface MarkdownPart {
  type:
    | "text"
    | "bold"
    | "italic"
    | "code"
    | "codeblock"
    | "strikethrough"
    | "link";
  content: string;
  href?: string;
}

// Patterns in order of precedence (code blocks and inline code first to prevent inner parsing)
const patterns = {
  codeblock: /```([\s\S]*?)```/g,
  code: /`([^`]+)`/g,
  bold: /\*\*(.+?)\*\*/g,
  // Italic: require non-asterisk before/after to avoid matching inside ** or across ** boundaries
  italic: /(?<!\*)\*([^*]+)\*(?!\*)/g,
  strikethrough: /~~(.+?)~~/g,
  link: /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
};

/**
 * Parse lite markdown into structured parts for React rendering.
 * Supports: **bold**, *italic*, `code`, ```codeblock```, ~~strikethrough~~, [text](url)
 */
export function parseMarkdown(text: string): MarkdownPart[] {
  if (!text) return [];

  const parts: MarkdownPart[] = [];
  const remaining = text;

  // Find all matches with their positions
  interface Match {
    type: MarkdownPart["type"];
    start: number;
    end: number;
    content: string;
    href?: string;
  }

  // Helper to check if a position overlaps with any existing match
  const overlapsWithAny = (
    start: number,
    end: number,
    existingMatches: Match[],
  ): boolean => {
    return existingMatches.some(
      (m) =>
        (start >= m.start && start < m.end) || // starts inside
        (end > m.start && end <= m.end) || // ends inside
        (start <= m.start && end >= m.end), // contains
    );
  };

  const findMatches = (input: string): Match[] => {
    const matches: Match[] = [];

    // Code blocks (must be first - highest precedence)
    for (const match of input.matchAll(patterns.codeblock)) {
      matches.push({
        type: "codeblock",
        start: match.index!,
        end: match.index! + match[0].length,
        content: match[1],
      });
    }

    // Inline code
    for (const match of input.matchAll(patterns.code)) {
      const start = match.index!;
      const end = start + match[0].length;
      if (!overlapsWithAny(start, end, matches)) {
        matches.push({
          type: "code",
          start,
          end,
          content: match[1],
        });
      }
    }

    // Bold (before italic due to ** vs *)
    for (const match of input.matchAll(patterns.bold)) {
      const start = match.index!;
      const end = start + match[0].length;
      if (!overlapsWithAny(start, end, matches)) {
        matches.push({
          type: "bold",
          start,
          end,
          content: match[1],
        });
      }
    }

    // Italic
    for (const match of input.matchAll(patterns.italic)) {
      const start = match.index!;
      const end = start + match[0].length;
      if (!overlapsWithAny(start, end, matches)) {
        matches.push({
          type: "italic",
          start,
          end,
          content: match[1],
        });
      }
    }

    // Strikethrough
    for (const match of input.matchAll(patterns.strikethrough)) {
      const start = match.index!;
      const end = start + match[0].length;
      if (!overlapsWithAny(start, end, matches)) {
        matches.push({
          type: "strikethrough",
          start,
          end,
          content: match[1],
        });
      }
    }

    // Links
    for (const match of input.matchAll(patterns.link)) {
      const start = match.index!;
      const end = start + match[0].length;
      if (!overlapsWithAny(start, end, matches)) {
        matches.push({
          type: "link",
          start,
          end,
          content: match[1],
          href: match[2],
        });
      }
    }

    // Sort by start position
    return matches.sort((a, b) => a.start - b.start);
  };

  const matches = findMatches(remaining);

  if (matches.length === 0) {
    return [{ type: "text", content: text }];
  }

  let lastEnd = 0;

  for (const match of matches) {
    // Add text before this match
    if (match.start > lastEnd) {
      parts.push({
        type: "text",
        content: remaining.slice(lastEnd, match.start),
      });
    }

    // Add the matched part
    parts.push({
      type: match.type,
      content: match.content,
      href: match.href,
    });

    lastEnd = match.end;
  }

  // Add remaining text
  if (lastEnd < remaining.length) {
    parts.push({
      type: "text",
      content: remaining.slice(lastEnd),
    });
  }

  return parts;
}

/**
 * Validate that a URL is safe (http/https only)
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
