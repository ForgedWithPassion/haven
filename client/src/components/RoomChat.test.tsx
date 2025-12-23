import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RoomChat from "./RoomChat";
import {
  type Room,
  type RoomMessage,
  type RoomMember,
} from "../storage/schema";
import { type RoomSystemEvent } from "./SystemMessage";
import { type UserInfo } from "../services/protocol";

const mockRoom: Room = {
  roomId: "room-1",
  name: "Test Room",
  isPublic: true,
  creatorId: "creator-1",
  creatorUsername: "creator",
  joinedAt: Date.now(),
  lastMessageAt: Date.now(),
  unreadCount: 0,
};

const mockMessages: RoomMessage[] = [
  {
    id: 1,
    roomId: "room-1",
    messageId: "msg-1",
    senderId: "user-1",
    senderUsername: "alice",
    content: "Hello room!",
    timestamp: Date.now() - 1000,
    isOwn: false,
  },
  {
    id: 2,
    roomId: "room-1",
    messageId: "msg-2",
    senderId: "current-user",
    senderUsername: "bob",
    content: "Hey everyone!",
    timestamp: Date.now(),
    isOwn: true,
  },
];

const mockMembers: RoomMember[] = [
  { odD: "user-1", username: "alice", roomId: "room-1" },
  { odD: "current-user", username: "bob", roomId: "room-1" },
];

const mockOnlineUsers: UserInfo[] = [
  { user_id: "user-1", username: "alice" },
  { user_id: "current-user", username: "bob" },
];

const defaultProps = {
  room: mockRoom,
  messages: mockMessages,
  members: mockMembers,
  onlineUsers: mockOnlineUsers,
  systemEvents: [] as RoomSystemEvent[],
  currentUserId: "current-user",
  use24Hour: false,
  onSend: vi.fn(),
  onBack: vi.fn(),
  onLeave: vi.fn(),
};

describe("RoomChat component", () => {
  describe("header", () => {
    it("displays room name", () => {
      render(<RoomChat {...defaultProps} />);
      expect(screen.getByText("Test Room")).toBeInTheDocument();
    });

    it("displays member count", () => {
      render(<RoomChat {...defaultProps} />);
      expect(screen.getByText("2 members")).toBeInTheDocument();
    });

    it("displays online count", () => {
      render(<RoomChat {...defaultProps} />);
      expect(screen.getByText("2 online")).toBeInTheDocument();
    });

    it("shows different styling for public rooms", () => {
      const { container } = render(<RoomChat {...defaultProps} />);
      // Public rooms have primary-hover background
      const avatar = container.querySelector(".peer-avatar");
      expect(avatar).toBeInTheDocument();
    });

    it("shows different styling for private rooms", () => {
      const privateRoom = { ...mockRoom, isPublic: false };
      const { container } = render(
        <RoomChat {...defaultProps} room={privateRoom} />,
      );
      const avatar = container.querySelector(".peer-avatar");
      expect(avatar).toBeInTheDocument();
    });

    it("calls onBack when back button clicked", () => {
      const onBack = vi.fn();
      render(<RoomChat {...defaultProps} onBack={onBack} />);
      fireEvent.click(screen.getByRole("button", { name: /back/i }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe("messages", () => {
    it("renders messages correctly", () => {
      render(<RoomChat {...defaultProps} />);
      expect(screen.getByText("Hello room!")).toBeInTheDocument();
      expect(screen.getByText("Hey everyone!")).toBeInTheDocument();
    });

    it("shows empty state when no messages", () => {
      render(<RoomChat {...defaultProps} messages={[]} systemEvents={[]} />);
      expect(screen.getByText("No messages yet")).toBeInTheDocument();
    });
  });

  describe("IRC-style message format", () => {
    it("renders messages with chat-line class", () => {
      const { container } = render(<RoomChat {...defaultProps} />);
      const chatLines = container.querySelectorAll(".chat-line");
      expect(chatLines.length).toBe(2);
    });

    it("marks own messages with own class", () => {
      const { container } = render(<RoomChat {...defaultProps} />);
      const ownMessages = container.querySelectorAll(".chat-line.own");
      expect(ownMessages.length).toBe(1); // Only Bob's message is own
    });

    it("displays sender usernames", () => {
      render(<RoomChat {...defaultProps} />);
      expect(screen.getByText("alice")).toBeInTheDocument();
      expect(screen.getByText("bob")).toBeInTheDocument();
    });

    it("renders message content in chat-content span", () => {
      const { container } = render(<RoomChat {...defaultProps} />);
      const contentSpans = container.querySelectorAll(".chat-content");
      expect(contentSpans.length).toBe(2);
      expect(contentSpans[0].textContent).toBe("Hello room!");
      expect(contentSpans[1].textContent).toBe("Hey everyone!");
    });
  });

  describe("system messages", () => {
    it("renders system events in timeline", () => {
      const systemEvents: RoomSystemEvent[] = [
        {
          id: "event-1",
          roomId: "room-1",
          type: "joined",
          username: "charlie",
          timestamp: Date.now(),
        },
      ];
      render(<RoomChat {...defaultProps} systemEvents={systemEvents} />);
      expect(screen.getByText("charlie joined the room")).toBeInTheDocument();
    });

    it("renders leave system events", () => {
      const systemEvents: RoomSystemEvent[] = [
        {
          id: "event-1",
          roomId: "room-1",
          type: "left",
          username: "charlie",
          timestamp: Date.now(),
        },
      ];
      render(<RoomChat {...defaultProps} systemEvents={systemEvents} />);
      expect(screen.getByText("charlie left the room")).toBeInTheDocument();
    });

    it("filters events for current room only", () => {
      const systemEvents: RoomSystemEvent[] = [
        {
          id: "event-1",
          roomId: "room-1",
          type: "joined",
          username: "charlie",
          timestamp: Date.now(),
        },
        {
          id: "event-2",
          roomId: "room-2",
          type: "joined",
          username: "dave",
          timestamp: Date.now(),
        },
      ];
      render(<RoomChat {...defaultProps} systemEvents={systemEvents} />);
      expect(screen.getByText("charlie joined the room")).toBeInTheDocument();
      expect(
        screen.queryByText("dave joined the room"),
      ).not.toBeInTheDocument();
    });
  });

  describe("input", () => {
    it("calls onSend when send button clicked", () => {
      const onSend = vi.fn();
      render(<RoomChat {...defaultProps} onSend={onSend} />);

      const input = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(input, { target: { value: "New message" } });
      const sendIcon = screen.getByTestId("SendIcon");
      fireEvent.click(sendIcon.closest("button")!);

      expect(onSend).toHaveBeenCalledWith("New message");
    });

    it("clears input after sending", () => {
      const onSend = vi.fn();
      render(<RoomChat {...defaultProps} onSend={onSend} />);

      const input = screen.getByPlaceholderText(
        "Type a message...",
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "New message" } });
      const sendIcon = screen.getByTestId("SendIcon");
      fireEvent.click(sendIcon.closest("button")!);

      expect(input.value).toBe("");
    });

    it("sends message on Enter key", () => {
      const onSend = vi.fn();
      render(<RoomChat {...defaultProps} onSend={onSend} />);

      const input = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(input, { target: { value: "New message" } });
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

      expect(onSend).toHaveBeenCalledWith("New message");
    });
  });

  describe("leave room", () => {
    it("shows leave confirmation dialog when leave button clicked", () => {
      render(<RoomChat {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: /leave room/i }));
      expect(screen.getByText("Leave Room?")).toBeInTheDocument();
    });

    it("calls onLeave when confirmed", () => {
      const onLeave = vi.fn();
      render(<RoomChat {...defaultProps} onLeave={onLeave} />);

      fireEvent.click(screen.getByRole("button", { name: /leave room/i }));
      fireEvent.click(screen.getByRole("button", { name: /^leave$/i }));

      expect(onLeave).toHaveBeenCalledTimes(1);
    });

    it("closes dialog when cancelled", () => {
      render(<RoomChat {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: /leave room/i }));
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(screen.queryByText("Leave Room?")).not.toBeInTheDocument();
    });
  });
});
