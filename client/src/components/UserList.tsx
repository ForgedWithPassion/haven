import { useState, useMemo } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { type UserInfo } from "../services/protocol";
import { type Favorite } from "../storage/schema";
import { type DMUnreadCounts } from "../hooks/useAppBadge";

interface UserListProps {
  users: UserInfo[];
  currentUserId: string | null;
  favorites: Favorite[];
  dmUnreadCounts: DMUnreadCounts;
  onSelectUser: (user: UserInfo) => void;
  onToggleFavorite: (userId: string, username: string) => void;
}

export default function UserList({
  users,
  currentUserId,
  favorites,
  dmUnreadCounts,
  onSelectUser,
  onToggleFavorite,
}: UserListProps) {
  const [favoritesExpanded, setFavoritesExpanded] = useState(true);

  // Filter out current user
  const otherUsers = users.filter((u) => u.user_id !== currentUserId);

  // Get set of favorited user IDs for quick lookup
  const favoriteIds = useMemo(
    () => new Set(favorites.map((f) => f.odD)),
    [favorites],
  );

  // Get set of online user IDs for quick lookup
  const onlineUserIds = useMemo(
    () => new Set(otherUsers.map((u) => u.user_id)),
    [otherUsers],
  );

  // Count online favorites
  const onlineFavoritesCount = useMemo(
    () => favorites.filter((f) => onlineUserIds.has(f.odD)).length,
    [favorites, onlineUserIds],
  );

  // Regular users are online users that are NOT favorited
  const regularUsers = useMemo(
    () => otherUsers.filter((u) => !favoriteIds.has(u.user_id)),
    [otherUsers, favoriteIds],
  );

  const renderUserItem = (user: UserInfo, isFavorited: boolean) => {
    const unreadCount = dmUnreadCounts[user.user_id] || 0;
    return (
      <div
        key={user.user_id}
        className="peer-item"
        onClick={() => onSelectUser(user)}
      >
        <div className="peer-avatar">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div>{user.username}</div>
        </div>
        {unreadCount > 0 && (
          <span
            style={{
              background: "var(--color-primary)",
              color: "white",
              padding: "0.125rem 0.5rem",
              borderRadius: "10px",
              fontSize: "0.75rem",
            }}
          >
            {unreadCount}
          </span>
        )}
        <Tooltip
          title={isFavorited ? "Remove from favorites" : "Add to favorites"}
        >
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(user.user_id, user.username);
            }}
            size="small"
            sx={{
              color: isFavorited
                ? "var(--color-primary)"
                : "var(--color-text-muted)",
            }}
          >
            {isFavorited ? (
              <StarIcon fontSize="small" />
            ) : (
              <StarBorderIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
        <span className="status-dot status-online" />
      </div>
    );
  };

  const renderFavoriteItem = (favorite: Favorite) => {
    const isOnline = onlineUserIds.has(favorite.odD);
    // Try to get username from online users if favorite doesn't have it (migration)
    const onlineUser = otherUsers.find((u) => u.user_id === favorite.odD);
    const username = favorite.username || onlineUser?.username || "?";
    const unreadCount = dmUnreadCounts[favorite.odD] || 0;

    // Create a UserInfo-like object for the favorite
    const userInfo: UserInfo = {
      user_id: favorite.odD,
      username: username,
    };

    return (
      <div
        key={favorite.odD}
        className="peer-item"
        style={{ opacity: isOnline ? 1 : 0.6 }}
        onClick={() => onSelectUser(userInfo)}
      >
        <div className="peer-avatar">{username.charAt(0).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div className="flex items-center gap-1">
            <span>{username}</span>
            {!isOnline && (
              <span className="text-small text-muted">offline</span>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <span
            style={{
              background: "var(--color-primary)",
              color: "white",
              padding: "0.125rem 0.5rem",
              borderRadius: "10px",
              fontSize: "0.75rem",
            }}
          >
            {unreadCount}
          </span>
        )}
        <Tooltip title="Remove from favorites">
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(favorite.odD, username);
            }}
            size="small"
            sx={{ color: "var(--color-primary)" }}
          >
            <StarIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <span
          className={`status-dot ${isOnline ? "status-online" : "status-offline"}`}
        />
      </div>
    );
  };

  if (otherUsers.length === 0 && favorites.length === 0) {
    return (
      <div className="text-center text-muted" style={{ padding: "2rem" }}>
        <p>No other users online</p>
        <p className="text-small" style={{ marginTop: "0.5rem" }}>
          Share Haven with friends to start chatting
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "100%", overflow: "auto" }}>
      {/* Favorites Section */}
      {favorites.length > 0 && (
        <>
          <div
            className="flex items-center justify-between"
            style={{
              padding: "0.75rem",
              borderBottom: "1px solid var(--color-border)",
              cursor: "pointer",
              background: "var(--color-bg-secondary)",
            }}
            onClick={() => setFavoritesExpanded(!favoritesExpanded)}
          >
            <div className="flex items-center gap-2">
              <StarIcon
                fontSize="small"
                sx={{ color: "var(--color-primary)" }}
              />
              <h3 style={{ fontSize: "0.9rem" }}>Favorites</h3>
              <span
                className="text-small"
                style={{
                  background: "var(--color-bg-tertiary)",
                  padding: "0.125rem 0.5rem",
                  borderRadius: "10px",
                }}
              >
                {onlineFavoritesCount}/{favorites.length} online
              </span>
            </div>
            {favoritesExpanded ? (
              <ExpandLessIcon fontSize="small" />
            ) : (
              <ExpandMoreIcon fontSize="small" />
            )}
          </div>
          {favoritesExpanded && (
            <div>{favorites.map((fav) => renderFavoriteItem(fav))}</div>
          )}
        </>
      )}

      {/* Online Users Section */}
      <h3
        style={{
          padding: "0.75rem",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        Online Users ({regularUsers.length})
      </h3>
      {regularUsers.length === 0 ? (
        <div className="text-center text-muted" style={{ padding: "2rem" }}>
          <p className="text-small">No other users online</p>
        </div>
      ) : (
        regularUsers.map((user) => renderUserItem(user, false))
      )}
    </div>
  );
}
