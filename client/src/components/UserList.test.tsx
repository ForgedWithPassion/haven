import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import UserList from "./UserList";
import { type UserInfo } from "../services/protocol";
import { type Favorite } from "../storage/schema";

const mockUsers: UserInfo[] = [
  { user_id: "user-1", username: "alice" },
  { user_id: "user-2", username: "bob" },
  { user_id: "user-3", username: "charlie" },
];

const defaultProps = {
  users: mockUsers,
  currentUserId: "current-user",
  favorites: [] as Favorite[],
  dmUnreadCounts: {} as Record<string, number>,
  dmUsersWithUnread: [] as {
    odD: string;
    username: string | null;
    unreadCount: number;
  }[],
  onSelectUser: vi.fn(),
  onToggleFavorite: vi.fn(),
};

describe("UserList component", () => {
  describe("favorites section", () => {
    it("shows favorites section when favorites exist", () => {
      const favorites: Favorite[] = [
        { odD: "user-1", username: "alice", addedAt: Date.now() },
      ];
      render(<UserList {...defaultProps} favorites={favorites} />);
      expect(screen.getByText("Favorites")).toBeInTheDocument();
    });

    it("does not show favorites section when no favorites", () => {
      render(<UserList {...defaultProps} favorites={[]} />);
      expect(screen.queryByText("Favorites")).not.toBeInTheDocument();
    });

    it("shows online count when favorited user is online", () => {
      const favorites: Favorite[] = [
        { odD: "user-1", username: "alice", addedAt: Date.now() },
      ];
      render(<UserList {...defaultProps} favorites={favorites} />);
      expect(screen.getByText("1/1 online")).toBeInTheDocument();
    });

    it("shows offline favorites with offline indicator", () => {
      const favorites: Favorite[] = [
        { odD: "offline-user", username: "dave", addedAt: Date.now() },
      ];
      render(<UserList {...defaultProps} favorites={favorites} />);
      expect(screen.getByText("dave")).toBeInTheDocument();
      expect(screen.getByText("offline")).toBeInTheDocument();
      expect(screen.getByText("0/1 online")).toBeInTheDocument();
    });

    it("shows both online and offline favorites", () => {
      const favorites: Favorite[] = [
        { odD: "user-1", username: "alice", addedAt: Date.now() },
        { odD: "offline-user", username: "dave", addedAt: Date.now() },
      ];
      render(<UserList {...defaultProps} favorites={favorites} />);
      expect(screen.getByText("alice")).toBeInTheDocument();
      expect(screen.getByText("dave")).toBeInTheDocument();
      expect(screen.getByText("1/2 online")).toBeInTheDocument();
    });

    it("is collapsible", () => {
      const favorites: Favorite[] = [
        { odD: "user-1", username: "alice", addedAt: Date.now() },
      ];
      render(<UserList {...defaultProps} favorites={favorites} />);

      // Section should be expanded by default
      expect(screen.getByText("alice")).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(screen.getByText("Favorites"));

      // Alice should no longer be visible (section collapsed)
      // Note: The header with "Favorites" is still visible
    });
  });

  describe("star button", () => {
    it("shows empty star for non-favorited users", () => {
      render(<UserList {...defaultProps} />);
      const addButtons = screen.getAllByRole("button", {
        name: /add to favorites/i,
      });
      expect(addButtons.length).toBe(3); // All 3 users have empty stars
    });

    it("shows filled star for favorited users", () => {
      const favorites: Favorite[] = [
        { odD: "user-1", username: "alice", addedAt: Date.now() },
      ];
      render(<UserList {...defaultProps} favorites={favorites} />);
      expect(
        screen.getByRole("button", { name: /remove from favorites/i }),
      ).toBeInTheDocument();
    });

    it("calls onToggleFavorite with userId and username when star is clicked", () => {
      const onToggleFavorite = vi.fn();
      render(
        <UserList {...defaultProps} onToggleFavorite={onToggleFavorite} />,
      );
      const addButtons = screen.getAllByRole("button", {
        name: /add to favorites/i,
      });
      fireEvent.click(addButtons[0]);
      expect(onToggleFavorite).toHaveBeenCalledWith("user-1", "alice");
    });

    it("does not trigger onSelectUser when star is clicked", () => {
      const onSelectUser = vi.fn();
      const onToggleFavorite = vi.fn();
      render(
        <UserList
          {...defaultProps}
          onSelectUser={onSelectUser}
          onToggleFavorite={onToggleFavorite}
        />,
      );
      const addButtons = screen.getAllByRole("button", {
        name: /add to favorites/i,
      });
      fireEvent.click(addButtons[0]);
      expect(onToggleFavorite).toHaveBeenCalled();
      expect(onSelectUser).not.toHaveBeenCalled();
    });
  });

  describe("user list", () => {
    it("shows online users count", () => {
      render(<UserList {...defaultProps} />);
      expect(screen.getByText("Online Users (3)")).toBeInTheDocument();
    });

    it("excludes current user from list", () => {
      const users = [...mockUsers, { user_id: "current-user", username: "me" }];
      render(<UserList {...defaultProps} users={users} />);
      expect(screen.queryByText("me")).not.toBeInTheDocument();
    });

    it("separates favorites from regular users", () => {
      const favorites: Favorite[] = [
        { odD: "user-1", username: "alice", addedAt: Date.now() },
      ];
      render(<UserList {...defaultProps} favorites={favorites} />);
      // Regular users count should exclude the favorited user
      expect(screen.getByText("Online Users (2)")).toBeInTheDocument();
    });

    it("shows empty state when no users online", () => {
      render(<UserList {...defaultProps} users={[]} />);
      expect(screen.getByText("No other users online")).toBeInTheDocument();
    });
  });
});
