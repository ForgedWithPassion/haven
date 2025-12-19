import { useState, useMemo } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { type UserInfo } from "../services/protocol";
import { type Favorite } from "../storage/schema";

interface UserListProps {
  users: UserInfo[];
  currentUserId: string | null;
  favorites: Favorite[];
  onSelectUser: (user: UserInfo) => void;
  onToggleFavorite: (userId: string) => void;
}

export default function UserList({
  users,
  currentUserId,
  favorites,
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

  // Split users into favorites and non-favorites
  const favoriteUsers = useMemo(
    () => otherUsers.filter((u) => favoriteIds.has(u.user_id)),
    [otherUsers, favoriteIds],
  );

  const regularUsers = useMemo(
    () => otherUsers.filter((u) => !favoriteIds.has(u.user_id)),
    [otherUsers, favoriteIds],
  );

  const renderUserItem = (user: UserInfo, isFavorited: boolean) => (
    <div
      key={user.user_id}
      className="peer-item"
      onClick={() => onSelectUser(user)}
    >
      <div className="peer-avatar">{user.username.charAt(0).toUpperCase()}</div>
      <div style={{ flex: 1 }}>
        <div>{user.username}</div>
      </div>
      <Tooltip
        title={isFavorited ? "Remove from favorites" : "Add to favorites"}
      >
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(user.user_id);
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
                {favoriteUsers.length} online
              </span>
            </div>
            {favoritesExpanded ? (
              <ExpandLessIcon fontSize="small" />
            ) : (
              <ExpandMoreIcon fontSize="small" />
            )}
          </div>
          {favoritesExpanded && (
            <div>
              {favoriteUsers.length === 0 ? (
                <div
                  className="text-center text-muted text-small"
                  style={{ padding: "1rem" }}
                >
                  No favorited users online
                </div>
              ) : (
                favoriteUsers.map((user) => renderUserItem(user, true))
              )}
            </div>
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
