import { useState, useRef, useEffect } from "react";
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

interface RoomChatProps {
  room: Room;
  messages: RoomMessage[];
  members: RoomMember[];
  currentUserId: string;
  onSend: (content: string) => void;
  onBack: () => void;
  onLeave: () => void;
}

export default function RoomChat({
  room,
  messages,
  members,
  currentUserId,
  onSend,
  onBack,
  onLeave,
}: RoomChatProps) {
  const [input, setInput] = useState("");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
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

  // Group consecutive messages from the same sender
  const groupedMessages = messages.reduce<
    Array<{ senderId: string; senderUsername: string; messages: RoomMessage[] }>
  >((groups, msg) => {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.senderId === msg.senderId) {
      lastGroup.messages.push(msg);
    } else {
      groups.push({
        senderId: msg.senderId,
        senderUsername: msg.senderUsername,
        messages: [msg],
      });
    }
    return groups;
  }, []);

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
          <div className="text-small text-muted">{members.length} members</div>
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
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="text-center text-muted" style={{ marginTop: "2rem" }}>
            <p>No messages yet</p>
            <p className="text-small">Be the first to say something!</p>
          </div>
        ) : (
          groupedMessages.map((group, groupIndex) => {
            const isOwn = group.senderId === currentUserId;
            return (
              <div
                key={groupIndex}
                style={{
                  marginBottom: "0.5rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isOwn ? "flex-end" : "flex-start",
                }}
              >
                {!isOwn && (
                  <div
                    className="text-small text-muted"
                    style={{ marginBottom: "0.25rem", marginLeft: "0.5rem" }}
                  >
                    {group.senderUsername}
                  </div>
                )}
                {group.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message ${isOwn ? "sent" : "received"}`}
                    style={{ marginBottom: "0.25rem" }}
                  >
                    <div>{msg.content}</div>
                    <div
                      className="text-small"
                      style={{ opacity: 0.7, marginTop: "0.25rem" }}
                    >
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            );
          })
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
