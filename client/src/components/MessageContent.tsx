import { parseMarkdown, isValidUrl } from "../utils/markdownParser";

interface MessageContentProps {
  content: string;
}

export default function MessageContent({ content }: MessageContentProps) {
  const parts = parseMarkdown(content);

  return (
    <span className="chat-content">
      {parts.map((part, i) => {
        switch (part.type) {
          case "bold":
            return <strong key={i}>{part.content}</strong>;
          case "italic":
            return <em key={i}>{part.content}</em>;
          case "code":
            return (
              <code key={i} className="md-code">
                {part.content}
              </code>
            );
          case "codeblock":
            return (
              <pre key={i} className="md-codeblock">
                <code>{part.content}</code>
              </pre>
            );
          case "strikethrough":
            return <del key={i}>{part.content}</del>;
          case "link":
            // Double-check URL safety
            if (part.href && isValidUrl(part.href)) {
              return (
                <a
                  key={i}
                  href={part.href}
                  className="md-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {part.content}
                </a>
              );
            }
            // Fallback to plain text if URL is invalid
            return <span key={i}>{part.content}</span>;
          default:
            return <span key={i}>{part.content}</span>;
        }
      })}
    </span>
  );
}
