import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAppBadge } from "./useAppBadge";
import * as appBadge from "../utils/appBadge";
import * as messages from "../storage/messages";
import { type Room } from "../storage/schema";

vi.mock("../utils/appBadge");
vi.mock("../storage/messages");

const createMockRoom = (overrides: Partial<Room> = {}): Room => ({
  roomId: "room-1",
  name: "Test Room",
  isPublic: true,
  creatorId: "creator-1",
  creatorUsername: "creator",
  joinedAt: Date.now(),
  lastMessageAt: Date.now(),
  unreadCount: 0,
  ...overrides,
});

describe("useAppBadge hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(messages.getConversations).mockResolvedValue([]);
    vi.mocked(appBadge.updateAllBadges).mockImplementation(() => {});
  });

  it("calculates total unread from rooms", async () => {
    const rooms = [
      createMockRoom({ roomId: "1", name: "Room 1", unreadCount: 3 }),
      createMockRoom({ roomId: "2", name: "Room 2", unreadCount: 2 }),
    ];

    const { result } = renderHook(() => useAppBadge(rooms));

    await waitFor(() => {
      expect(result.current.totalUnreadCount).toBe(5);
    });
  });

  it("includes DM unread counts in total", async () => {
    vi.mocked(messages.getConversations).mockResolvedValue([
      { odD: "user1", username: null, unreadCount: 3, lastMessage: {} as any },
      { odD: "user2", username: null, unreadCount: 2, lastMessage: {} as any },
    ]);

    const { result } = renderHook(() => useAppBadge([]));

    await waitFor(() => {
      expect(result.current.totalDMUnreadCount).toBe(5);
      expect(result.current.dmUnreadCounts).toEqual({
        user1: 3,
        user2: 2,
      });
    });
  });

  it("combines room and DM counts for total", async () => {
    vi.mocked(messages.getConversations).mockResolvedValue([
      { odD: "user1", username: null, unreadCount: 3, lastMessage: {} as any },
    ]);

    const rooms = [createMockRoom({ unreadCount: 2 })];

    const { result } = renderHook(() => useAppBadge(rooms));

    await waitFor(() => {
      expect(result.current.totalUnreadCount).toBe(5); // 2 room + 3 DM
    });
  });

  it("calls updateAllBadges when count changes", async () => {
    const { rerender } = renderHook(({ rooms }) => useAppBadge(rooms), {
      initialProps: { rooms: [] as Room[] },
    });

    await waitFor(() => {
      expect(appBadge.updateAllBadges).toHaveBeenCalledWith(0);
    });

    rerender({ rooms: [createMockRoom({ unreadCount: 5 })] });

    await waitFor(() => {
      expect(appBadge.updateAllBadges).toHaveBeenCalledWith(5);
    });
  });

  it("refreshDMCounts updates DM unread state", async () => {
    vi.mocked(messages.getConversations).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useAppBadge([]));

    await waitFor(() => {
      expect(result.current.totalDMUnreadCount).toBe(0);
    });

    vi.mocked(messages.getConversations).mockResolvedValueOnce([
      { odD: "user1", username: null, unreadCount: 7, lastMessage: {} as any },
    ]);

    await act(async () => {
      await result.current.refreshDMCounts();
    });

    expect(result.current.dmUnreadCounts).toEqual({ user1: 7 });
    expect(result.current.totalDMUnreadCount).toBe(7);
  });

  it("only includes conversations with unread count > 0", async () => {
    vi.mocked(messages.getConversations).mockResolvedValue([
      { odD: "user1", username: null, unreadCount: 3, lastMessage: {} as any },
      { odD: "user2", username: null, unreadCount: 0, lastMessage: {} as any },
      { odD: "user3", username: null, unreadCount: 5, lastMessage: {} as any },
    ]);

    const { result } = renderHook(() => useAppBadge([]));

    await waitFor(() => {
      expect(result.current.dmUnreadCounts).toEqual({
        user1: 3,
        user3: 5,
      });
      expect(result.current.totalDMUnreadCount).toBe(8);
    });
  });

  it("handles error in getConversations gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(messages.getConversations).mockRejectedValue(
      new Error("DB error"),
    );

    const { result } = renderHook(() => useAppBadge([]));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    // Should still have empty counts, not crash
    expect(result.current.dmUnreadCounts).toEqual({});
    expect(result.current.totalDMUnreadCount).toBe(0);

    consoleSpy.mockRestore();
  });

  it("returns 0 for totalUnreadCount with no rooms and no DMs", async () => {
    vi.mocked(messages.getConversations).mockResolvedValue([]);

    const { result } = renderHook(() => useAppBadge([]));

    await waitFor(() => {
      expect(result.current.totalUnreadCount).toBe(0);
      expect(result.current.totalDMUnreadCount).toBe(0);
    });
  });
});
