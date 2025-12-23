import { useState, useRef, useEffect, useMemo } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SendIcon from "@mui/icons-material/Send";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import PublicIcon from "@mui/icons-material/Public";
import LockIcon from "@mui/icons-material/Lock";
import {
  type Room,
  type RoomMessage,
  type RoomMember,
} from "../storage/schema";
import SystemMessage, { type RoomSystemEvent } from "./SystemMessage";
import MessageContent from "./MessageContent";
import { type UserInfo } from "../services/protocol";
import { useVisualViewport } from "../hooks/useVisualViewport";
import { formatTime } from "../utils/formatTime";

interface RoomChatProps {
  room: Room;
  messages: RoomMessage[];
  members: RoomMember[];
  onlineUsers: UserInfo[];
  systemEvents: RoomSystemEvent[];
  currentUserId: string;
  use24Hour: boolean;
  onSend: (content: string) => void;
  onBack: () => void;
  onLeave: () => void;
}

export default function RoomChat({
  room,
  messages,
  members,
  onlineUsers,
  systemEvents,
  currentUserId: _currentUserId,
  use24Hour,
  onSend,
  onBack,
  onLeave,
}: RoomChatProps) {
  const [input, setInput] = useState("");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledInitially = useRef(false);
  const prevTimelineLengthRef = useRef(0);

  // Handle mobile keyboard viewport
  useVisualViewport();

  // Calculate online member count
  const onlineUserIds = useMemo(
    () => new Set(onlineUsers.map((u) => u.user_id)),
    [onlineUsers],
  );
  const onlineCount = useMemo(
    () => members.filter((m) => onlineUserIds.has(m.odD)).length,
    [members, onlineUserIds],
  );

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

  // Combine messages and system events, sorted by timestamp
  type TimelineItem =
    | { type: "message"; data: RoomMessage }
    | { type: "system"; data: RoomSystemEvent };

  const timeline = useMemo(() => {
    const items: TimelineItem[] = [
      ...messages.map((m) => ({ type: "message" as const, data: m })),
      ...systemEvents
        .filter((e) => e.roomId === room.roomId)
        .map((e) => ({ type: "system" as const, data: e })),
    ];
    return items.sort((a, b) => {
      const aTime = a.type === "message" ? a.data.timestamp : a.data.timestamp;
      const bTime = b.type === "message" ? b.data.timestamp : b.data.timestamp;
      return aTime - bTime;
    });
  }, [messages, systemEvents, room.roomId]);

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
          style={{
            width: 32,
            height: 32,
            background: room.isPublic
              ? "var(--color-primary-hover)"
              : "var(--color-bg-tertiary)",
          }}
        >
          {room.isPublic ? (
            <PublicIcon fontSize="small" />
          ) : (
            <LockIcon fontSize="small" />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500 }}>{room.name}</div>
          <div className="room-member-count">
            <span>{members.length} members</span>
            <span>·</span>
            <span className="status-dot status-online" />
            <span>{onlineCount} online</span>
          </div>
        </div>
        <Tooltip title="Leave room">
          <IconButton
            onClick={() => setShowLeaveConfirm(true)}
            size="small"
            sx={{ color: "var(--color-text)" }}
          >
            <ExitToAppIcon />
          </IconButton>
        </Tooltip>
      </div>

      {/* Messages */}
      <div className="chat-messages" ref={messagesContainerRef}>
        {messages.length === 0 && systemEvents.length === 0 ? (
          <div className="text-center text-muted" style={{ marginTop: "2rem" }}>
            <p>No messages yet</p>
            <p className="text-small">Be the first to say something!</p>
          </div>
        ) : (
          timeline.map((item) => {
            if (item.type === "system") {
              return (
                <SystemMessage key={`sys-${item.data.id}`} event={item.data} />
              );
            }
            const msg = item.data;
            const isOwn = msg.isOwn;
            return (
              <div
                key={`msg-${msg.id}`}
                className={`chat-line ${isOwn ? "own" : ""}`}
              >
                <div className="chat-meta">
                  <span>[</span>
                  <span>{formatTime(msg.timestamp, use24Hour)}</span>
                  <span>-</span>
                  <span className="chat-author">{msg.senderUsername}</span>
                  <span>]</span>
                </div>
                <MessageContent content={msg.content} />
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

      {/* Leave confirmation dialog */}
      {showLeaveConfirm && (
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
          onClick={() => setShowLeaveConfirm(false)}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "300px", textAlign: "center" }}
          >
            <h3 style={{ marginBottom: "1rem" }}>Leave Room?</h3>
            <p className="text-muted" style={{ marginBottom: "1.5rem" }}>
              You will no longer receive messages from this room. You can rejoin
              later if the room is public.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                className="secondary"
                onClick={() => setShowLeaveConfirm(false)}
              >
                Cancel
              </button>
              <button
                style={{ background: "var(--color-error)", color: "white" }}
                onClick={() => {
                  onLeave();
                  setShowLeaveConfirm(false);
                }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
