import { useState, useRef, useEffect } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SendIcon from "@mui/icons-material/Send";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ReplayIcon from "@mui/icons-material/Replay";
import { type Message } from "../storage/schema";

interface ChatProps {
  username: string;
  odD: string;
  messages: Message[];
  onSend: (content: string) => void;
  onBack: () => void;
  onClear: () => void;
  onRetry?: (messageId: number, content: string) => void;
}

export default function Chat({
  username,
  messages,
  onSend,
  onBack,
  onClear,
  onRetry,
}: ChatProps) {
  const [input, setInput] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    const content = input.trim();
    if (content) {
      onSend(content);
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <div
        className="flex items-center gap-2"
        style={{
          padding: "0.75rem",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-bg-secondary)",
        }}
      >
        <Tooltip title="Back">
          <IconButton
            onClick={onBack}
            size="small"
            sx={{ color: "var(--color-text)" }}
          >
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        <div
          className="peer-avatar"
          style={{ width: 32, height: 32, fontSize: "0.875rem" }}
        >
          {username.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500 }}>{username}</div>
        </div>
        <Tooltip title="Clear messages">
          <IconButton
            onClick={() => setShowClearConfirm(true)}
            size="small"
            sx={{ color: "var(--color-text)" }}
          >
            <DeleteOutlineIcon />
          </IconButton>
        </Tooltip>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="text-center text-muted" style={{ marginTop: "2rem" }}>
            <p>No messages yet</p>
            <p className="text-small">
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.direction === "sent" ? "sent" : "received"} ${msg.status === "failed" ? "failed" : ""}`}
            >
              <div>{msg.content}</div>
              <div
                className="flex items-center gap-1 text-small text-muted"
                style={{ marginTop: "0.25rem", opacity: 0.7 }}
              >
                <span>{formatTime(msg.timestamp)}</span>
                {msg.direction === "sent" && msg.status === "failed" && (
                  <>
                    <span style={{ color: "var(--color-error)" }}>
                      - Failed
                    </span>
                    {onRetry && msg.id && (
                      <Tooltip title="Retry">
                        <IconButton
                          onClick={() => onRetry(msg.id!, msg.content)}
                          size="small"
                          sx={{
                            padding: "2px",
                            color: "var(--color-error)",
                            "&:hover": { color: "var(--color-primary)" },
                          }}
                        >
                          <ReplayIcon sx={{ fontSize: "1rem" }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          autoFocus
        />
        <Tooltip title="Send">
          <span>
            <IconButton
              onClick={handleSend}
              disabled={!input.trim()}
              sx={{
                color: input.trim()
                  ? "var(--color-primary)"
                  : "var(--color-text-muted)",
              }}
            >
              <SendIcon />
            </IconButton>
          </span>
        </Tooltip>
      </div>

      {/* Clear confirmation dialog */}
      {showClearConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "300px", textAlign: "center" }}
          >
            <h3 style={{ marginBottom: "1rem" }}>Clear Messages?</h3>
            <p className="text-muted" style={{ marginBottom: "1.5rem" }}>
              This will delete all messages in this conversation. This action
              cannot be undone.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                className="secondary"
                onClick={() => setShowClearConfirm(false)}
              >
                Cancel
              </button>
              <button
                style={{ background: "var(--color-error)", color: "white" }}
                onClick={() => {
                  onClear();
                  setShowClearConfirm(false);
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
