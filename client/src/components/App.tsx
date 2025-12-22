import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Badge from "@mui/material/Badge";
import ChatIcon from "@mui/icons-material/Chat";
import ForumIcon from "@mui/icons-material/Forum";
import SettingsIcon from "@mui/icons-material/Settings";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";

import Login from "./Login";
import UserList from "./UserList";
import Chat from "./Chat";
import RoomList from "./RoomList";
import RoomChat from "./RoomChat";
import Settings from "./Settings";
import CreateRoomModal from "./CreateRoomModal";
import RecoveryCodeModal from "./RecoveryCodeModal";
import PWAUpdateBanner from "./PWAUpdateBanner";
import { type RoomSystemEvent, type ChatSystemEvent } from "./SystemMessage";

import { useAuth } from "../hooks/useAuth";
import { useWebSocket } from "../hooks/useWebSocket";
import { useMessages } from "../hooks/useMessages";
import { useRooms, useRoom } from "../hooks/useRooms";
import { useNotifications } from "../hooks/useNotifications";
import { usePWA } from "../hooks/usePWA";
import { useAppBadge } from "../hooks/useAppBadge";
import {
  deleteConversation,
  deleteRoom,
  markLastMessageAsFailed,
  deleteMessage,
  getFavorites,
  addFavorite,
  removeFavorite,
  isFavorite as checkIsFavorite,
  type Favorite,
} from "../storage";
import { getFingerprint } from "../services/fingerprint";
import { type UserInfo } from "../services/protocol";

type View = "users" | "chat" | "rooms" | "room" | "settings";

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("haven_theme");
    return saved ? saved === "dark" : true;
  });

  const [view, setView] = useState<View>("users");
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [pendingRecoveryCode, setPendingRecoveryCode] = useState<string | null>(
    null,
  );
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);
  const [roomSystemEvents, setRoomSystemEvents] = useState<RoomSystemEvent[]>(
    [],
  );
  const [chatSystemEvents, setChatSystemEvents] = useState<ChatSystemEvent[]>(
    [],
  );
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [selectedUserFavorited, setSelectedUserFavorited] = useState(false);

  // Track username -> user_id for sent messages (used for error handling)
  const sentTargetsRef = useRef<Map<string, string>>(new Map());
  // Track previous online users for detecting offline events (rooms)
  const prevUsersRef = useRef<UserInfo[]>([]);
  // Track selected user's online status for chat system messages
  const selectedUserOnlineRef = useRef<boolean | null>(null);

  const auth = useAuth();
  const notifications = useNotifications();

  // Track current view state for notification logic
  const currentViewRef = useRef({ view, selectedUser, selectedRoomId });
  useEffect(() => {
    currentViewRef.current = { view, selectedUser, selectedRoomId };
  }, [view, selectedUser, selectedRoomId]);
  const { status: pwaStatus, actions: pwaActions } = usePWA();

  // Load fingerprint on mount
  useEffect(() => {
    getFingerprint().then(setFingerprint).catch(console.error);
  }, []);

  // Load favorites on mount
  const refreshFavorites = useCallback(async () => {
    const favs = await getFavorites();
    setFavorites(favs);
  }, []);

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites]);

  // Check if selected user is favorited
  useEffect(() => {
    if (selectedUser) {
      checkIsFavorite(selectedUser.user_id).then(setSelectedUserFavorited);
    }
  }, [selectedUser]);

  const {
    status,
    users,
    rooms: serverRooms,
    error,
    register,
    sendDirectMessage,
    createRoom,
    joinRoom,
    leaveRoom,
    sendRoomMessage,
    requestUserList,
    requestRoomList,
    clearError,
  } = useWebSocket({
    autoConnect: true,
    currentUserId: auth.userId || undefined,
    onRegistered: (userId, username, recoveryCode, isNewUser) => {
      auth.login(userId, username, recoveryCode);
      setIsRegistering(false);
      // Show recovery code for new users
      if (isNewUser && recoveryCode) {
        setPendingRecoveryCode(recoveryCode);
      }
      // Request initial data
      requestUserList();
      requestRoomList();
    },
    onRegisterFailed: (err) => {
      setRegisterError(err);
      setIsRegistering(false);
    },
    onKicked: (reason) => {
      auth.logout();
      setKickedMessage(reason);
    },
    onDirectMessageFailed: async (targetUsername) => {
      // Look up user_id from our sent targets map
      const targetUserId = sentTargetsRef.current.get(targetUsername);
      if (targetUserId) {
        await markLastMessageAsFailed(targetUserId);
      }
    },
    onRoomMemberEvent: (roomId, action, userId, username) => {
      // Don't show events for ourselves
      if (userId === auth.userId) return;

      const event: RoomSystemEvent = {
        id: `${roomId}-${action}-${userId}-${Date.now()}`,
        roomId,
        type: action,
        username,
        timestamp: Date.now(),
      };
      setRoomSystemEvents((prev) => [...prev, event]);
    },
    onNotifyDirectMessage: (senderId, senderName, content) => {
      // Refresh DM unread counts
      refreshDMCounts();

      // Don't notify if viewing this conversation
      const { view, selectedUser } = currentViewRef.current;
      if (view === "chat" && selectedUser?.user_id === senderId) return;

      notifications.notify({
        title: senderName,
        body:
          content.length > 100 ? content.substring(0, 100) + "..." : content,
        tag: `dm-${senderId}`,
        data: { type: "dm", userId: senderId },
      });
    },
    onNotifyRoomMessage: (roomId, senderName, content) => {
      // Don't notify if viewing this room
      const { view, selectedRoomId } = currentViewRef.current;
      if (view === "room" && selectedRoomId === roomId) return;

      // Find room name
      const room = localRooms.find((r) => r.roomId === roomId);
      const roomName = room?.name || "Room";

      notifications.notify({
        title: `${senderName} in ${roomName}`,
        body:
          content.length > 100 ? content.substring(0, 100) + "..." : content,
        tag: `room-${roomId}`,
        data: { type: "room", roomId },
      });
    },
  });

  const { messages, refresh: refreshMessages } = useMessages(
    selectedUser?.user_id || null,
  );
  const { rooms: localRooms, refresh: refreshRooms } = useRooms();
  const { dmUnreadCounts, totalDMUnreadCount, refreshDMCounts } =
    useAppBadge(localRooms);
  const {
    room: selectedRoom,
    messages: roomMessages,
    members: roomMembers,
    refresh: refreshRoom,
  } = useRoom(selectedRoomId);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light",
    );
    localStorage.setItem("haven_theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  // Re-register on reconnect if we have a stored username
  useEffect(() => {
    if (
      status === "connected" &&
      auth.isLoggedIn &&
      auth.username &&
      fingerprint
    ) {
      register(auth.username, fingerprint);
    }
  }, [status, auth.isLoggedIn, auth.username, fingerprint, register]);

  // Rejoin rooms after registration
  useEffect(() => {
    if (status === "registered" && localRooms.length > 0) {
      // Rejoin all rooms we have locally
      localRooms.forEach((room) => {
        joinRoom(room.roomId);
      });
    }
  }, [status, localRooms, joinRoom]);

  // Auto-refresh rooms periodically
  useEffect(() => {
    if (status === "registered") {
      const interval = setInterval(() => {
        requestRoomList();
        refreshRooms();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [status, requestRoomList, refreshRooms]);

  // Refresh room messages when viewing a room
  useEffect(() => {
    if (selectedRoomId) {
      const interval = setInterval(refreshRoom, 2000);
      return () => clearInterval(interval);
    }
  }, [selectedRoomId, refreshRoom]);

  // Refresh messages when viewing chat
  useEffect(() => {
    if (selectedUser) {
      // Also refresh DM counts to update badges after marking as read
      const interval = setInterval(() => {
        refreshMessages();
        refreshDMCounts();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [selectedUser, refreshMessages, refreshDMCounts]);

  // Track users going offline for room system messages
  useEffect(() => {
    if (!selectedRoomId) return;

    const prevUsers = prevUsersRef.current;
    const currentUserIds = new Set(users.map((u) => u.user_id));

    // Find users who went offline
    for (const prevUser of prevUsers) {
      if (
        !currentUserIds.has(prevUser.user_id) &&
        prevUser.user_id !== auth.userId
      ) {
        // Check if this user was a member of the current room
        const wasMember = roomMembers.some((m) => m.odD === prevUser.user_id);
        if (wasMember) {
          const event: RoomSystemEvent = {
            id: `${selectedRoomId}-offline-${prevUser.user_id}-${Date.now()}`,
            roomId: selectedRoomId,
            type: "offline",
            username: prevUser.username,
            timestamp: Date.now(),
          };
          setRoomSystemEvents((prev) => [...prev, event]);
        }
      }
    }

    prevUsersRef.current = users;
  }, [users, selectedRoomId, roomMembers, auth.userId]);

  // Track users going online/offline for DM chat system messages
  useEffect(() => {
    if (!selectedUser) {
      // Reset tracking when no user selected
      selectedUserOnlineRef.current = null;
      return;
    }

    const isOnline = users.some((u) => u.user_id === selectedUser.user_id);
    const wasOnline = selectedUserOnlineRef.current;

    // Only trigger events on actual status changes (not on initial load)
    if (wasOnline !== null && wasOnline !== isOnline) {
      const event: ChatSystemEvent = {
        id: `chat-${isOnline ? "online" : "offline"}-${selectedUser.user_id}-${Date.now()}`,
        odD: selectedUser.user_id,
        type: isOnline ? "online" : "offline",
        username: selectedUser.username,
        timestamp: Date.now(),
      };
      setChatSystemEvents((prev) => [...prev, event]);
    }

    // Update the tracked status
    selectedUserOnlineRef.current = isOnline;
  }, [users, selectedUser]);

  // Get joined room IDs
  const joinedRoomIds = useMemo(
    () => new Set(localRooms.map((r) => r.roomId)),
    [localRooms],
  );

  const handleLogin = useCallback(
    (username: string, recoveryCode?: string) => {
      if (!fingerprint) {
        setRegisterError("Unable to initialize. Please refresh the page.");
        return;
      }
      setRegisterError(null);
      setKickedMessage(null);
      setIsRegistering(true);
      register(username, fingerprint, recoveryCode);
    },
    [fingerprint, register],
  );

  const handleSelectUser = useCallback((user: UserInfo) => {
    setSelectedUser(user);
    setView("chat");
  }, []);

  const handleSelectRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
    setView("room");
  }, []);

  const handleSendDirectMessage = useCallback(
    async (content: string) => {
      if (selectedUser) {
        // Track the mapping for error handling
        sentTargetsRef.current.set(selectedUser.username, selectedUser.user_id);
        await sendDirectMessage(
          selectedUser.username,
          selectedUser.user_id,
          content,
        );
        refreshMessages();
      }
    },
    [selectedUser, sendDirectMessage, refreshMessages],
  );

  const handleSendRoomMessage = useCallback(
    (content: string) => {
      if (selectedRoomId) {
        sendRoomMessage(selectedRoomId, content);
        setTimeout(refreshRoom, 100);
      }
    },
    [selectedRoomId, sendRoomMessage, refreshRoom],
  );

  const handleClearChat = useCallback(async () => {
    if (selectedUser) {
      await deleteConversation(selectedUser.user_id);
      refreshMessages();
    }
  }, [selectedUser, refreshMessages]);

  const handleRetryMessage = useCallback(
    async (messageId: number, content: string) => {
      if (selectedUser) {
        // Delete the failed message
        await deleteMessage(messageId);
        // Resend
        sentTargetsRef.current.set(selectedUser.username, selectedUser.user_id);
        await sendDirectMessage(
          selectedUser.username,
          selectedUser.user_id,
          content,
        );
        refreshMessages();
      }
    },
    [selectedUser, sendDirectMessage, refreshMessages],
  );

  const handleLeaveRoom = useCallback(async () => {
    if (selectedRoomId) {
      leaveRoom(selectedRoomId);
      await deleteRoom(selectedRoomId);
      setSelectedRoomId(null);
      setView("rooms");
      refreshRooms();
    }
  }, [selectedRoomId, leaveRoom, refreshRooms]);

  const handleCreateRoom = useCallback(
    (name: string, isPublic: boolean) => {
      createRoom(name, isPublic);
      setTimeout(refreshRooms, 500);
    },
    [createRoom, refreshRooms],
  );

  const handleJoinRoom = useCallback(
    (roomId: string) => {
      joinRoom(roomId);
      setTimeout(() => {
        refreshRooms();
        setSelectedRoomId(roomId);
        setView("room");
      }, 500);
    },
    [joinRoom, refreshRooms],
  );

  const handleToggleFavorite = useCallback(
    async (userId: string, username: string) => {
      const isFav = await checkIsFavorite(userId);
      if (isFav) {
        await removeFavorite(userId);
      } else {
        await addFavorite(userId, username);
      }
      refreshFavorites();
      // Update selected user favorite status if needed
      if (selectedUser?.user_id === userId) {
        setSelectedUserFavorited(!isFav);
      }
    },
    [refreshFavorites, selectedUser],
  );

  const handleToggleSelectedUserFavorite = useCallback(async () => {
    if (!selectedUser) return;
    await handleToggleFavorite(selectedUser.user_id, selectedUser.username);
  }, [selectedUser, handleToggleFavorite]);

  // Check if selected user is online
  const isSelectedUserOnline = useMemo(
    () => selectedUser && users.some((u) => u.user_id === selectedUser.user_id),
    [selectedUser, users],
  );

  // Show login if not authenticated
  if (auth.isLoading || !fingerprint) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: "100vh" }}
      >
        <div className="spinner" />
      </div>
    );
  }

  if (!auth.isLoggedIn || status !== "registered") {
    const displayError =
      kickedMessage || registerError || (error ? error : null);
    return (
      <Login
        onLogin={handleLogin}
        error={displayError}
        isLoading={isRegistering || status === "connecting"}
      />
    );
  }

  // Main app UI
  return (
    <div className="flex flex-col" style={{ height: "100%" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between"
        style={{
          padding: "0.5rem 1rem",
          paddingTop: "calc(0.5rem + env(safe-area-inset-top))",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-bg-secondary)",
          flexShrink: 0,
        }}
      >
        <div className="flex items-center gap-2">
          <img
            src="/favicon.svg"
            alt="Haven"
            style={{ width: 28, height: 28 }}
          />
          <span
            className={`status-dot ${status === "registered" ? "status-online" : "status-connecting"}`}
          />
          <span className="text-muted text-small">{auth.username}</span>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip title="Users">
            <IconButton
              onClick={() => setView("users")}
              size="small"
              sx={{
                color:
                  view === "users"
                    ? "var(--color-primary)"
                    : "var(--color-text)",
              }}
            >
              <Badge badgeContent={totalDMUnreadCount} color="primary">
                <ChatIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Rooms">
            <IconButton
              onClick={() => setView("rooms")}
              size="small"
              sx={{
                color:
                  view === "rooms"
                    ? "var(--color-primary)"
                    : "var(--color-text)",
              }}
            >
              <Badge
                badgeContent={localRooms.reduce(
                  (sum, r) => sum + r.unreadCount,
                  0,
                )}
                color="primary"
              >
                <ForumIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Settings">
            <IconButton
              onClick={() => setView("settings")}
              size="small"
              sx={{
                color:
                  view === "settings"
                    ? "var(--color-primary)"
                    : "var(--color-text)",
              }}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          <div
            style={{
              width: "1px",
              height: "24px",
              background: "var(--color-border)",
              margin: "0 0.25rem",
            }}
          />

          <Tooltip title={isDarkMode ? "Light mode" : "Dark mode"}>
            <IconButton
              onClick={() => setIsDarkMode(!isDarkMode)}
              size="small"
              sx={{ color: "var(--color-text)" }}
            >
              {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
        </div>
      </header>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {view === "users" && (
          <UserList
            users={users}
            currentUserId={auth.userId}
            favorites={favorites}
            dmUnreadCounts={dmUnreadCounts}
            onSelectUser={handleSelectUser}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {view === "chat" && selectedUser && (
          <Chat
            username={selectedUser.username}
            odD={selectedUser.user_id}
            messages={messages}
            isUserOnline={isSelectedUserOnline ?? false}
            systemEvents={chatSystemEvents}
            isFavorite={selectedUserFavorited}
            onSend={handleSendDirectMessage}
            onBack={() => {
              setSelectedUser(null);
              setView("users");
            }}
            onClear={handleClearChat}
            onRetry={handleRetryMessage}
            onToggleFavorite={handleToggleSelectedUserFavorite}
          />
        )}

        {view === "rooms" && (
          <RoomList
            rooms={localRooms}
            discoverRooms={serverRooms}
            joinedRoomIds={joinedRoomIds}
            onSelectRoom={handleSelectRoom}
            onCreateRoom={() => setShowCreateRoom(true)}
            onJoinRoom={handleJoinRoom}
            onRefreshDiscover={requestRoomList}
          />
        )}

        {view === "room" && selectedRoom && (
          <RoomChat
            room={selectedRoom}
            messages={roomMessages}
            members={roomMembers}
            onlineUsers={users}
            systemEvents={roomSystemEvents}
            currentUserId={auth.userId || ""}
            onSend={handleSendRoomMessage}
            onBack={() => {
              setSelectedRoomId(null);
              setView("rooms");
            }}
            onLeave={handleLeaveRoom}
          />
        )}

        {view === "settings" && (
          <Settings
            username={auth.username || ""}
            recoveryCode={auth.recoveryCode}
            notificationsSupported={notifications.isSupported}
            notificationsEnabled={notifications.isEnabled}
            notificationPermission={notifications.permission}
            onEnableNotifications={notifications.enable}
            onDisableNotifications={notifications.disable}
            onBack={() => setView("users")}
            onLogout={auth.logout}
          />
        )}
      </main>

      {/* Create room modal */}
      {showCreateRoom && (
        <CreateRoomModal
          onClose={() => setShowCreateRoom(false)}
          onCreate={handleCreateRoom}
        />
      )}

      {/* Error toast */}
      {error && (
        <div
          className="toast"
          onClick={clearError}
          style={{ cursor: "pointer" }}
        >
          {error}
        </div>
      )}

      {/* Recovery code modal (shown once after first registration) */}
      {pendingRecoveryCode && (
        <RecoveryCodeModal
          recoveryCode={pendingRecoveryCode}
          onDismiss={() => setPendingRecoveryCode(null)}
        />
      )}

      {/* PWA update banner */}
      <PWAUpdateBanner
        needRefresh={pwaStatus.needRefresh}
        offlineReady={pwaStatus.offlineReady}
        onAcceptUpdate={pwaActions.acceptUpdate}
        onDismissUpdate={pwaActions.dismissUpdate}
        onDismissOfflineReady={pwaActions.dismissOfflineReady}
      />
    </div>
  );
}
