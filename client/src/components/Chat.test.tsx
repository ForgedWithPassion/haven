import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Chat from "./Chat";
import { type Message } from "../storage/schema";
import { type ChatSystemEvent } from "./SystemMessage";

const mockMessages: Message[] = [
  {
    id: 1,
    odD: "user-1",
    direction: "sent",
    content: "Hello",
    timestamp: Date.now() - 1000,
    status: "sent",
  },
  {
    id: 2,
    odD: "user-1",
    direction: "received",
    content: "Hi there",
    timestamp: Date.now(),
    status: "delivered",
  },
];

const defaultProps = {
  partnerUsername: "alice",
  currentUsername: "bob",
  odD: "user-1",
  messages: mockMessages,
  isUserOnline: true,
  systemEvents: [] as ChatSystemEvent[],
  isFavorite: false,
  use24Hour: false,
  onSend: vi.fn(),
  onBack: vi.fn(),
  onClear: vi.fn(),
  onRetry: vi.fn(),
  onToggleFavorite: vi.fn(),
};

describe("Chat component", () => {
  describe("online status indicator", () => {
    it("shows online status when user is online", () => {
      render(<Chat {...defaultProps} isUserOnline={true} />);
      expect(screen.getByText("online")).toBeInTheDocument();
    });

    it("shows offline status when user is offline", () => {
      render(<Chat {...defaultProps} isUserOnline={false} />);
      expect(screen.getByText("offline")).toBeInTheDocument();
    });
  });

  describe("favorite button", () => {
    it("shows empty star when not favorited", () => {
      render(<Chat {...defaultProps} isFavorite={false} />);
      expect(
        screen.getByRole("button", { name: /add to favorites/i }),
      ).toBeInTheDocument();
    });

    it("shows filled star when favorited", () => {
      render(<Chat {...defaultProps} isFavorite={true} />);
      expect(
        screen.getByRole("button", { name: /remove from favorites/i }),
      ).toBeInTheDocument();
    });

    it("calls onToggleFavorite when clicked", () => {
      const onToggleFavorite = vi.fn();
      render(<Chat {...defaultProps} onToggleFavorite={onToggleFavorite} />);
      fireEvent.click(
        screen.getByRole("button", { name: /add to favorites/i }),
      );
      expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    });
  });

  describe("system messages", () => {
    it("renders system events in timeline", () => {
      const systemEvents: ChatSystemEvent[] = [
        {
          id: "event-1",
          odD: "user-1",
          type: "online",
          username: "alice",
          timestamp: Date.now() - 500,
        },
      ];
      render(<Chat {...defaultProps} systemEvents={systemEvents} />);
      expect(screen.getByText("alice is online")).toBeInTheDocument();
    });

    it("renders offline system events", () => {
      const systemEvents: ChatSystemEvent[] = [
        {
          id: "event-1",
          odD: "user-1",
          type: "offline",
          username: "alice",
          timestamp: Date.now() - 500,
        },
      ];
      render(<Chat {...defaultProps} systemEvents={systemEvents} />);
      expect(screen.getByText("alice went offline")).toBeInTheDocument();
    });

    it("filters events for current user only", () => {
      const systemEvents: ChatSystemEvent[] = [
        {
          id: "event-1",
          odD: "user-1",
          type: "online",
          username: "alice",
          timestamp: Date.now(),
        },
        {
          id: "event-2",
          odD: "user-2",
          type: "online",
          username: "bob",
          timestamp: Date.now(),
        },
      ];
      render(<Chat {...defaultProps} systemEvents={systemEvents} />);
      expect(screen.getByText("alice is online")).toBeInTheDocument();
      expect(screen.queryByText("bob is online")).not.toBeInTheDocument();
    });
  });

  describe("messages", () => {
    it("renders messages correctly", () => {
      render(<Chat {...defaultProps} />);
      expect(screen.getByText("Hello")).toBeInTheDocument();
      expect(screen.getByText("Hi there")).toBeInTheDocument();
    });

    it("shows empty state when no messages", () => {
      render(<Chat {...defaultProps} messages={[]} systemEvents={[]} />);
      expect(screen.getByText("No messages yet")).toBeInTheDocument();
    });
  });

  describe("IRC-style message format", () => {
    it("renders messages with chat-line class", () => {
      const { container } = render(<Chat {...defaultProps} />);
      const chatLines = container.querySelectorAll(".chat-line");
      expect(chatLines.length).toBe(2);
    });

    it("marks own messages with own class", () => {
      const { container } = render(<Chat {...defaultProps} />);
      const ownMessages = container.querySelectorAll(".chat-line.own");
      expect(ownMessages.length).toBe(1); // Only the "sent" message
    });

    it("displays correct author for sent messages", () => {
      render(<Chat {...defaultProps} />);
      // currentUsername is "bob" for sent messages
      expect(screen.getByText("bob")).toBeInTheDocument();
    });

    it("displays correct author for received messages", () => {
      const { container } = render(<Chat {...defaultProps} />);
      // partnerUsername is "alice" for received messages
      const aliceAuthors = container.querySelectorAll(".chat-author");
      const hasAlice = Array.from(aliceAuthors).some(
        (el) => el.textContent === "alice",
      );
      expect(hasAlice).toBe(true);
    });

    it("renders message content in chat-content span", () => {
      const { container } = render(<Chat {...defaultProps} />);
      const contentSpans = container.querySelectorAll(".chat-content");
      expect(contentSpans.length).toBe(2);
      expect(contentSpans[0].textContent).toBe("Hello");
      expect(contentSpans[1].textContent).toBe("Hi there");
    });
  });
});
