import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import PublicIcon from "@mui/icons-material/Public";
import LockIcon from "@mui/icons-material/Lock";
import { type Room } from "../storage/schema";

interface RoomListProps {
  rooms: Room[];
  onSelectRoom: (roomId: string) => void;
  onCreateRoom: () => void;
}

export default function RoomList({
  rooms,
  onSelectRoom,
  onCreateRoom,
}: RoomListProps) {
  return (
    <div className="flex flex-col">
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

      {rooms.length === 0 ? (
        <div className="text-center text-muted" style={{ padding: "2rem" }}>
          <p>No rooms joined</p>
          <p className="text-small" style={{ marginTop: "0.5rem" }}>
            Create a room or browse public rooms
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
    </div>
  );
}
