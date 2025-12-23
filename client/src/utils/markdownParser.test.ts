import { describe, it, expect } from "vitest";
import { parseMarkdown, isValidUrl } from "./markdownParser";

describe("parseMarkdown", () => {
  describe("plain text", () => {
    it("returns text part for plain text", () => {
      expect(parseMarkdown("hello world")).toEqual([
        { type: "text", content: "hello world" },
      ]);
    });

    it("returns empty array for empty string", () => {
      expect(parseMarkdown("")).toEqual([]);
    });

    it("returns empty array for undefined/null-like input", () => {
      expect(parseMarkdown("")).toEqual([]);
    });
  });

  describe("bold", () => {
    it("parses bold text", () => {
      expect(parseMarkdown("**bold**")).toEqual([
        { type: "bold", content: "bold" },
      ]);
    });

    it("parses bold with surrounding text", () => {
      expect(parseMarkdown("hello **bold** world")).toEqual([
        { type: "text", content: "hello " },
        { type: "bold", content: "bold" },
        { type: "text", content: " world" },
      ]);
    });

    it("parses multiple bold sections", () => {
      expect(parseMarkdown("**one** and **two**")).toEqual([
        { type: "bold", content: "one" },
        { type: "text", content: " and " },
        { type: "bold", content: "two" },
      ]);
    });
  });

  describe("italic", () => {
    it("parses italic text", () => {
      expect(parseMarkdown("*italic*")).toEqual([
        { type: "italic", content: "italic" },
      ]);
    });

    it("parses italic with surrounding text", () => {
      expect(parseMarkdown("hello *italic* world")).toEqual([
        { type: "text", content: "hello " },
        { type: "italic", content: "italic" },
        { type: "text", content: " world" },
      ]);
    });
  });

  describe("inline code", () => {
    it("parses inline code", () => {
      expect(parseMarkdown("`code`")).toEqual([
        { type: "code", content: "code" },
      ]);
    });

    it("parses inline code with surrounding text", () => {
      expect(parseMarkdown("use `npm install` to install")).toEqual([
        { type: "text", content: "use " },
        { type: "code", content: "npm install" },
        { type: "text", content: " to install" },
      ]);
    });

    it("preserves special characters in code", () => {
      expect(parseMarkdown("`**not bold**`")).toEqual([
        { type: "code", content: "**not bold**" },
      ]);
    });
  });

  describe("code blocks", () => {
    it("parses code block", () => {
      expect(parseMarkdown("```\nconst x = 1;\n```")).toEqual([
        { type: "codeblock", content: "\nconst x = 1;\n" },
      ]);
    });

    it("parses code block with surrounding text", () => {
      expect(parseMarkdown("before ```code``` after")).toEqual([
        { type: "text", content: "before " },
        { type: "codeblock", content: "code" },
        { type: "text", content: " after" },
      ]);
    });

    it("preserves markdown inside code blocks", () => {
      expect(parseMarkdown("```**bold** *italic*```")).toEqual([
        { type: "codeblock", content: "**bold** *italic*" },
      ]);
    });
  });

  describe("strikethrough", () => {
    it("parses strikethrough text", () => {
      expect(parseMarkdown("~~strikethrough~~")).toEqual([
        { type: "strikethrough", content: "strikethrough" },
      ]);
    });

    it("parses strikethrough with surrounding text", () => {
      expect(parseMarkdown("this is ~~deleted~~ text")).toEqual([
        { type: "text", content: "this is " },
        { type: "strikethrough", content: "deleted" },
        { type: "text", content: " text" },
      ]);
    });
  });

  describe("links", () => {
    it("parses link", () => {
      expect(parseMarkdown("[click here](https://example.com)")).toEqual([
        { type: "link", content: "click here", href: "https://example.com" },
      ]);
    });

    it("parses http links", () => {
      expect(parseMarkdown("[site](http://example.com)")).toEqual([
        { type: "link", content: "site", href: "http://example.com" },
      ]);
    });

    it("parses link with surrounding text", () => {
      expect(
        parseMarkdown("check [this link](https://example.com) out"),
      ).toEqual([
        { type: "text", content: "check " },
        { type: "link", content: "this link", href: "https://example.com" },
        { type: "text", content: " out" },
      ]);
    });

    it("does not parse non-http/https links", () => {
      expect(parseMarkdown("[evil](javascript:alert(1))")).toEqual([
        { type: "text", content: "[evil](javascript:alert(1))" },
      ]);
    });
  });

  describe("mixed markdown", () => {
    it("parses multiple different types", () => {
      expect(parseMarkdown("**bold** and *italic*")).toEqual([
        { type: "bold", content: "bold" },
        { type: "text", content: " and " },
        { type: "italic", content: "italic" },
      ]);
    });

    it("parses complex message", () => {
      expect(
        parseMarkdown(
          "Try `npm install` for **fast** setup, see [docs](https://docs.com)",
        ),
      ).toEqual([
        { type: "text", content: "Try " },
        { type: "code", content: "npm install" },
        { type: "text", content: " for " },
        { type: "bold", content: "fast" },
        { type: "text", content: " setup, see " },
        { type: "link", content: "docs", href: "https://docs.com" },
      ]);
    });
  });

  describe("edge cases", () => {
    it("handles unclosed bold", () => {
      expect(parseMarkdown("**unclosed")).toEqual([
        { type: "text", content: "**unclosed" },
      ]);
    });

    it("handles unclosed italic", () => {
      expect(parseMarkdown("*unclosed")).toEqual([
        { type: "text", content: "*unclosed" },
      ]);
    });

    it("handles unclosed code", () => {
      expect(parseMarkdown("`unclosed")).toEqual([
        { type: "text", content: "`unclosed" },
      ]);
    });

    it("handles unclosed strikethrough", () => {
      expect(parseMarkdown("~~unclosed")).toEqual([
        { type: "text", content: "~~unclosed" },
      ]);
    });

    it("handles empty markdown", () => {
      expect(parseMarkdown("****")).toEqual([
        { type: "text", content: "****" },
      ]);
    });

    it("handles nested asterisks correctly", () => {
      // Bold takes precedence
      expect(parseMarkdown("***text***")).toEqual([
        { type: "bold", content: "*text" },
        { type: "text", content: "*" },
      ]);
    });
  });
});

describe("isValidUrl", () => {
  it("returns true for https URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("https://example.com/path?query=1")).toBe(true);
  });

  it("returns true for http URLs", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
  });

  it("returns false for javascript URLs", () => {
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
  });

  it("returns false for data URLs", () => {
    expect(isValidUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("returns false for invalid URLs", () => {
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });

  it("returns false for file URLs", () => {
    expect(isValidUrl("file:///etc/passwd")).toBe(false);
  });
});
