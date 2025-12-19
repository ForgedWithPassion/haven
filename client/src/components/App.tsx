import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import ChatIcon from '@mui/icons-material/Chat';
import ForumIcon from '@mui/icons-material/Forum';
import ExploreIcon from '@mui/icons-material/Explore';
import SettingsIcon from '@mui/icons-material/Settings';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';

import Login from './Login';
import UserList from './UserList';
import Chat from './Chat';
import RoomList from './RoomList';
import RoomChat from './RoomChat';
import PublicRooms from './PublicRooms';
import Settings from './Settings';
import CreateRoomModal from './CreateRoomModal';
import RecoveryCodeModal from './RecoveryCodeModal';

import { useAuth } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';
import { useMessages } from '../hooks/useMessages';
import { useRooms, useRoom } from '../hooks/useRooms';
import { deleteConversation, deleteRoom, markLastMessageAsFailed, deleteMessage } from '../storage';
import { getFingerprint } from '../services/fingerprint';
import { type UserInfo } from '../services/protocol';

type View = 'users' | 'chat' | 'rooms' | 'room' | 'discover' | 'settings';

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('haven_theme');
    return saved ? saved === 'dark' : true;
  });

  const [view, setView] = useState<View>('users');
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [pendingRecoveryCode, setPendingRecoveryCode] = useState<string | null>(null);
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);

  // Track username -> user_id for sent messages (used for error handling)
  const sentTargetsRef = useRef<Map<string, string>>(new Map());

  const auth = useAuth();

  // Load fingerprint on mount
  useEffect(() => {
    getFingerprint().then(setFingerprint).catch(console.error);
  }, []);

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
  });

  const { messages, refresh: refreshMessages } = useMessages(selectedUser?.user_id || null);
  const { rooms: localRooms, refresh: refreshRooms } = useRooms();
  const { room: selectedRoom, messages: roomMessages, members: roomMembers, refresh: refreshRoom } = useRoom(selectedRoomId);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('haven_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Re-register on reconnect if we have a stored username
  useEffect(() => {
    if (status === 'connected' && auth.isLoggedIn && auth.username && fingerprint) {
      register(auth.username, fingerprint);
    }
  }, [status, auth.isLoggedIn, auth.username, fingerprint, register]);

  // Rejoin rooms after registration
  useEffect(() => {
    if (status === 'registered' && localRooms.length > 0) {
      // Rejoin all rooms we have locally
      localRooms.forEach((room) => {
        joinRoom(room.roomId);
      });
    }
  }, [status, localRooms, joinRoom]);

  // Auto-refresh rooms periodically
  useEffect(() => {
    if (status === 'registered') {
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
      const interval = setInterval(refreshMessages, 2000);
      return () => clearInterval(interval);
    }
  }, [selectedUser, refreshMessages]);


  // Get joined room IDs
  const joinedRoomIds = useMemo(() => new Set(localRooms.map((r) => r.roomId)), [localRooms]);

  const handleLogin = useCallback(
    (username: string, recoveryCode?: string) => {
      if (!fingerprint) {
        setRegisterError('Unable to initialize. Please refresh the page.');
        return;
      }
      setRegisterError(null);
      setKickedMessage(null);
      setIsRegistering(true);
      register(username, fingerprint, recoveryCode);
    },
    [fingerprint, register]
  );

  const handleSelectUser = useCallback((user: UserInfo) => {
    setSelectedUser(user);
    setView('chat');
  }, []);

  const handleSelectRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
    setView('room');
  }, []);

  const handleSendDirectMessage = useCallback(
    async (content: string) => {
      if (selectedUser) {
        // Track the mapping for error handling
        sentTargetsRef.current.set(selectedUser.username, selectedUser.user_id);
        await sendDirectMessage(selectedUser.username, selectedUser.user_id, content);
        refreshMessages();
      }
    },
    [selectedUser, sendDirectMessage, refreshMessages]
  );

  const handleSendRoomMessage = useCallback(
    (content: string) => {
      if (selectedRoomId) {
        sendRoomMessage(selectedRoomId, content);
        setTimeout(refreshRoom, 100);
      }
    },
    [selectedRoomId, sendRoomMessage, refreshRoom]
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
        await sendDirectMessage(selectedUser.username, selectedUser.user_id, content);
        refreshMessages();
      }
    },
    [selectedUser, sendDirectMessage, refreshMessages]
  );

  const handleLeaveRoom = useCallback(async () => {
    if (selectedRoomId) {
      leaveRoom(selectedRoomId);
      await deleteRoom(selectedRoomId);
      setSelectedRoomId(null);
      setView('rooms');
      refreshRooms();
    }
  }, [selectedRoomId, leaveRoom, refreshRooms]);

  const handleCreateRoom = useCallback(
    (name: string, isPublic: boolean) => {
      createRoom(name, isPublic);
      setTimeout(refreshRooms, 500);
    },
    [createRoom, refreshRooms]
  );

  const handleJoinRoom = useCallback(
    (roomId: string) => {
      joinRoom(roomId);
      setTimeout(refreshRooms, 500);
    },
    [joinRoom, refreshRooms]
  );

  // Show login if not authenticated
  if (auth.isLoading || !fingerprint) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!auth.isLoggedIn || status !== 'registered') {
    const displayError = kickedMessage || registerError || (error ? error : null);
    return (
      <Login onLogin={handleLogin} error={displayError} isLoading={isRegistering || status === 'connecting'} />
    );
  }

  // Main app UI
  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between"
        style={{
          padding: '0.5rem 1rem',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
          flexShrink: 0,
        }}
      >
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="Haven" style={{ width: 28, height: 28 }} />
          <span className={`status-dot ${status === 'registered' ? 'status-online' : 'status-connecting'}`} />
          <span className="text-muted text-small">{auth.username}</span>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip title="Users">
            <IconButton
              onClick={() => setView('users')}
              size="small"
              sx={{ color: view === 'users' ? 'var(--color-primary)' : 'var(--color-text)' }}
            >
              <ChatIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Rooms">
            <IconButton
              onClick={() => setView('rooms')}
              size="small"
              sx={{ color: view === 'rooms' ? 'var(--color-primary)' : 'var(--color-text)' }}
            >
              <Badge badgeContent={localRooms.reduce((sum, r) => sum + r.unreadCount, 0)} color="primary">
                <ForumIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Discover">
            <IconButton
              onClick={() => {
                setView('discover');
                requestRoomList();
              }}
              size="small"
              sx={{ color: view === 'discover' ? 'var(--color-primary)' : 'var(--color-text)' }}
            >
              <ExploreIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Settings">
            <IconButton
              onClick={() => setView('settings')}
              size="small"
              sx={{ color: view === 'settings' ? 'var(--color-primary)' : 'var(--color-text)' }}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          <div
            style={{
              width: '1px',
              height: '24px',
              background: 'var(--color-border)',
              margin: '0 0.25rem',
            }}
          />

          <Tooltip title={isDarkMode ? 'Light mode' : 'Dark mode'}>
            <IconButton
              onClick={() => setIsDarkMode(!isDarkMode)}
              size="small"
              sx={{ color: 'var(--color-text)' }}
            >
              {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {view === 'users' && (
          <UserList users={users} currentUserId={auth.userId} onSelectUser={handleSelectUser} />
        )}

        {view === 'chat' && selectedUser && (
          <Chat
            username={selectedUser.username}
            odD={selectedUser.user_id}
            messages={messages}
            onSend={handleSendDirectMessage}
            onBack={() => {
              setSelectedUser(null);
              setView('users');
            }}
            onClear={handleClearChat}
            onRetry={handleRetryMessage}
          />
        )}

        {view === 'rooms' && (
          <RoomList rooms={localRooms} onSelectRoom={handleSelectRoom} onCreateRoom={() => setShowCreateRoom(true)} />
        )}

        {view === 'room' && selectedRoom && (
          <RoomChat
            room={selectedRoom}
            messages={roomMessages}
            members={roomMembers}
            currentUserId={auth.userId || ''}
            onSend={handleSendRoomMessage}
            onBack={() => {
              setSelectedRoomId(null);
              setView('rooms');
            }}
            onLeave={handleLeaveRoom}
          />
        )}

        {view === 'discover' && (
          <PublicRooms
            rooms={serverRooms}
            joinedRoomIds={joinedRoomIds}
            onJoin={handleJoinRoom}
            onRefresh={requestRoomList}
          />
        )}

        {view === 'settings' && (
          <Settings
            username={auth.username || ''}
            recoveryCode={auth.recoveryCode}
            onBack={() => setView('users')}
            onLogout={auth.logout}
          />
        )}
      </main>

      {/* Create room modal */}
      {showCreateRoom && <CreateRoomModal onClose={() => setShowCreateRoom(false)} onCreate={handleCreateRoom} />}

      {/* Error toast */}
      {error && (
        <div className="toast" onClick={clearError} style={{ cursor: 'pointer' }}>
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
    </div>
  );
}
