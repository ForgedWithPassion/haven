import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import PublicIcon from "@mui/icons-material/Public";
import LockIcon from "@mui/icons-material/Lock";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { type Room } from "../storage/schema";
import { type RoomInfo } from "../services/protocol";

interface RoomListProps {
  rooms: Room[];
  discoverRooms: RoomInfo[];
  joinedRoomIds: Set<string>;
  onSelectRoom: (roomId: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  onRefreshDiscover: () => void;
}

export default function RoomList({
  rooms,
  discoverRooms,
  joinedRoomIds,
  onSelectRoom,
  onCreateRoom,
  onJoinRoom,
  onRefreshDiscover,
}: RoomListProps) {
  const [discoverExpanded, setDiscoverExpanded] = useState(false);

  const availableRooms = discoverRooms.filter(
    (r) => r.is_public && !joinedRoomIds.has(r.room_id),
  );

  return (
    <div className="flex flex-col" style={{ height: "100%", overflow: "auto" }}>
      {/* My Rooms Header */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: "0.75rem",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <h3>Rooms ({rooms.length})</h3>
        <Tooltip title="Create Room">
          <IconButton
            onClick={onCreateRoom}
            size="small"
            sx={{ color: "var(--color-text)" }}
          >
            <AddIcon />
          </IconButton>
        </Tooltip>
      </div>

      {/* My Rooms List */}
      {rooms.length === 0 ? (
        <div className="text-center text-muted" style={{ padding: "2rem" }}>
          <p>No rooms joined</p>
          <p className="text-small" style={{ marginTop: "0.5rem" }}>
            Create a room or discover public rooms below
          </p>
        </div>
      ) : (
        rooms.map((room) => (
          <div
            key={room.roomId}
            className="peer-item"
            onClick={() => onSelectRoom(room.roomId)}
          >
            <div
              className="peer-avatar"
              style={{
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="truncate">{room.name}</div>
              <div className="text-small text-muted">
                by {room.creatorUsername}
              </div>
            </div>
            {room.unreadCount > 0 && (
              <span
                style={{
                  background: "var(--color-primary)",
                  color: "white",
                  padding: "0.125rem 0.5rem",
                  borderRadius: "10px",
                  fontSize: "0.75rem",
                }}
              >
                {room.unreadCount}
              </span>
            )}
          </div>
        ))
      )}

      {/* Discover Rooms Section */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: "0.75rem",
          borderTop: "1px solid var(--color-border)",
          borderBottom: discoverExpanded
            ? "1px solid var(--color-border)"
            : "none",
          cursor: "pointer",
          background: "var(--color-bg-secondary)",
        }}
        onClick={() => setDiscoverExpanded(!discoverExpanded)}
      >
        <div className="flex items-center gap-2">
          <h3 style={{ fontSize: "0.9rem" }}>Discover Rooms</h3>
          {availableRooms.length > 0 && (
            <span
              className="text-small"
              style={{
                background: "var(--color-bg-tertiary)",
                padding: "0.125rem 0.5rem",
                borderRadius: "10px",
              }}
            >
              {availableRooms.length}
            </span>
          )}
        </div>
        <div className="flex items-center">
          {discoverExpanded && (
            <Tooltip title="Refresh">
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  onRefreshDiscover();
                }}
                size="small"
                sx={{ color: "var(--color-text)" }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {discoverExpanded ? (
            <ExpandLessIcon fontSize="small" />
          ) : (
            <ExpandMoreIcon fontSize="small" />
          )}
        </div>
      </div>

      {/* Discover Rooms List (collapsible) */}
      {discoverExpanded && (
        <div>
          {availableRooms.length === 0 ? (
            <div
              className="text-center text-muted"
              style={{ padding: "1.5rem" }}
            >
              <p className="text-small">No public rooms available</p>
            </div>
          ) : (
            availableRooms.map((room) => (
              <div
                key={room.room_id}
                className="peer-item"
                onClick={() => onJoinRoom(room.room_id)}
              >
                <div
                  className="peer-avatar"
                  style={{ background: "var(--color-primary-hover)" }}
                >
                  <PublicIcon fontSize="small" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="truncate">{room.name}</div>
                  <div className="text-small text-muted">
                    {room.member_count} member
                    {room.member_count !== 1 ? "s" : ""} - by {room.creator}
                  </div>
                </div>
                <button
                  className="secondary"
                  style={{ padding: "0.25rem 0.75rem", fontSize: "0.875rem" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onJoinRoom(room.room_id);
                  }}
                >
                  Join
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
