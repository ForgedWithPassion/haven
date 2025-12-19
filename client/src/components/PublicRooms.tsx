import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import RefreshIcon from "@mui/icons-material/Refresh";
import PublicIcon from "@mui/icons-material/Public";
import { type RoomInfo } from "../services/protocol";

interface PublicRoomsProps {
  rooms: RoomInfo[];
  joinedRoomIds: Set<string>;
  onJoin: (roomId: string) => void;
  onRefresh: () => void;
}

export default function PublicRooms({
  rooms,
  joinedRoomIds,
  onJoin,
  onRefresh,
}: PublicRoomsProps) {
  const publicRooms = rooms.filter((r) => r.is_public);
  const availableRooms = publicRooms.filter(
    (r) => !joinedRoomIds.has(r.room_id),
  );

  return (
    <div className="flex flex-col">
      <div
        className="flex items-center justify-between"
        style={{
          padding: "0.75rem",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <h3>Public Rooms</h3>
        <Tooltip title="Refresh">
          <IconButton
            onClick={onRefresh}
            size="small"
            sx={{ color: "var(--color-text)" }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </div>

      {availableRooms.length === 0 ? (
        <div className="text-center text-muted" style={{ padding: "2rem" }}>
          <p>No public rooms available</p>
          <p className="text-small" style={{ marginTop: "0.5rem" }}>
            Create one to get started!
          </p>
        </div>
      ) : (
        availableRooms.map((room) => (
          <div
            key={room.room_id}
            className="peer-item"
            onClick={() => onJoin(room.room_id)}
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
                {room.member_count} member{room.member_count !== 1 ? "s" : ""} -
                by {room.creator}
              </div>
            </div>
            <button
              className="secondary"
              style={{ padding: "0.25rem 0.75rem", fontSize: "0.875rem" }}
              onClick={(e) => {
                e.stopPropagation();
                onJoin(room.room_id);
              }}
            >
              Join
            </button>
          </div>
        ))
      )}
    </div>
  );
}
