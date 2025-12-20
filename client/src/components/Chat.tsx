import { useState, useRef, useEffect, useMemo } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SendIcon from "@mui/icons-material/Send";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ReplayIcon from "@mui/icons-material/Replay";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { type Message } from "../storage/schema";
import SystemMessage, { type ChatSystemEvent } from "./SystemMessage";
import { useVisualViewport } from "../hooks/useVisualViewport";

interface ChatProps {
  username: string;
  odD: string;
  messages: Message[];
  isUserOnline: boolean;
  systemEvents: ChatSystemEvent[];
  isFavorite: boolean;
  onSend: (content: string) => void;
  onBack: () => void;
  onClear: () => void;
  onRetry?: (messageId: number, content: string) => void;
  onToggleFavorite: () => void;
}

export default function Chat({
  username,
  odD,
  messages,
  isUserOnline,
  systemEvents,
  isFavorite,
  onSend,
  onBack,
  onClear,
  onRetry,
  onToggleFavorite,
}: ChatProps) {
  const [input, setInput] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledInitially = useRef(false);
  const prevTimelineLengthRef = useRef(0);

  // Handle mobile keyboard viewport
  useVisualViewport();

  // Merge messages and system events, sorted by timestamp
  type TimelineItem =
    | { type: "message"; data: Message }
    | { type: "event"; data: ChatSystemEvent };

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    // Filter events for this user
    const userEvents = systemEvents.filter((e) => e.odD === odD);

    messages.forEach((msg) => {
      items.push({ type: "message", data: msg });
    });

    userEvents.forEach((event) => {
      items.push({ type: "event", data: event });
    });

    return items.sort((a, b) => {
      const aTime = a.type === "message" ? a.data.timestamp : a.data.timestamp;
      const bTime = b.type === "message" ? b.data.timestamp : b.data.timestamp;
      return aTime - bTime;
    });
  }, [messages, systemEvents, odD]);

  // Scroll to bottom on initial load only (after DOM renders)
  useEffect(() => {
    if (
      !hasScrolledInitially.current &&
      messagesContainerRef.current &&
      timeline.length > 0
    ) {
      hasScrolledInitially.current = true;
      // Wait for DOM to render before scrolling
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop =
            messagesContainerRef.current.scrollHeight;
        }
      });
    }
  }, [timeline]);

  // Auto-scroll when new messages arrive (if user is near bottom)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || timeline.length === 0) return;

    // Only auto-scroll if we have new messages
    if (timeline.length > prevTimelineLengthRef.current) {
      // Check if user is near bottom (within 100px)
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        100;

      if (isNearBottom) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }

    prevTimelineLengthRef.current = timeline.length;
  }, [timeline]);

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
        <div style={{ position: "relative" }}>
          <div
            className="peer-avatar"
            style={{ width: 32, height: 32, fontSize: "0.875rem" }}
          >
            {username.charAt(0).toUpperCase()}
          </div>
          <span
            className={`status-dot ${isUserOnline ? "status-online" : "status-offline"}`}
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 10,
              height: 10,
              border: "2px solid var(--color-bg-secondary)",
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div className="flex items-center gap-1">
            <span style={{ fontWeight: 500 }}>{username}</span>
            <span className="text-small text-muted">
              {isUserOnline ? "online" : "offline"}
            </span>
          </div>
        </div>
        <Tooltip
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <IconButton
            onClick={onToggleFavorite}
            size="small"
            sx={{
              color: isFavorite ? "var(--color-primary)" : "var(--color-text)",
            }}
          >
            {isFavorite ? <StarIcon /> : <StarBorderIcon />}
          </IconButton>
        </Tooltip>
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
      <div className="chat-messages" ref={messagesContainerRef}>
        {timeline.length === 0 ? (
          <div className="text-center text-muted" style={{ marginTop: "2rem" }}>
            <p>No messages yet</p>
            <p className="text-small">
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          timeline.map((item) => {
            if (item.type === "event") {
              return <SystemMessage key={item.data.id} event={item.data} />;
            }
            const msg = item.data;
            return (
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
            );
          })
        )}
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
