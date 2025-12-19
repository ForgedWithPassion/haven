export interface RoomSystemEvent {
  id: string;
  roomId: string;
  type: "joined" | "left" | "offline";
  username: string;
  timestamp: number;
}

export interface ChatSystemEvent {
  id: string;
  odD: string;
  type: "online" | "offline";
  username: string;
  timestamp: number;
}

interface SystemMessageProps {
  event: RoomSystemEvent | ChatSystemEvent;
}

export default function SystemMessage({ event }: SystemMessageProps) {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getMessage = () => {
    switch (event.type) {
      case "joined":
        return `${event.username} joined the room`;
      case "left":
        return `${event.username} left the room`;
      case "offline":
        return `${event.username} went offline`;
      case "online":
        return `${event.username} is online`;
    }
  };

  const showWarning = event.type === "left" || event.type === "offline";

  return (
    <div className="system-message">
      <div className="system-message-content">
        <span className="system-message-line" />
        <span className="system-message-text">{getMessage()}</span>
        <span className="system-message-line" />
      </div>
      {showWarning && (
        <div className="system-message-warning">
          will not receive new messages
        </div>
      )}
      <div className="system-message-time">{formatTime(event.timestamp)}</div>
    </div>
  );
}
