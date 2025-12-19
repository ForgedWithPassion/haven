import { useState, useEffect, useCallback, useRef } from "react";
import {
  WebSocketService,
  type ConnectionStatus,
  type WebSocketEvents,
} from "../services/websocket";
import {
  type UserInfo,
  type RoomInfo,
  type IncomingDirectMessage,
  type IncomingRoomMessage,
} from "../services/protocol";
import {
  storeMessage,
  storeRoomMessage,
  storeRoom,
  deleteRoom,
  incrementUnreadCount,
  setRoomMembers,
  addRoomMember,
  removeRoomMember,
} from "../storage";

interface UseWebSocketOptions {
  autoConnect?: boolean;
  currentUserId?: string;
  onRegistered?: (
    userId: string,
    username: string,
    recoveryCode?: string,
    isNewUser?: boolean,
  ) => void;
  onRegisterFailed?: (error: string) => void;
  onKicked?: (reason: string) => void;
  onDirectMessageFailed?: (targetUsername: string) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const serviceRef = useRef<WebSocketService | null>(null);
  const callbacksRef = useRef(options);

  // Keep callbacks ref updated
  useEffect(() => {
    callbacksRef.current = options;
  }, [options]);

  useEffect(() => {
    const wsUrl =
      import.meta.env.VITE_WS_URL ||
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;

    const events: WebSocketEvents = {
      onStatusChange: setStatus,

      onRegistered: (userId, username, recoveryCode, isNewUser) => {
        callbacksRef.current.onRegistered?.(
          userId,
          username,
          recoveryCode,
          isNewUser,
        );
      },

      onRegisterFailed: (err) => {
        setError(err);
        callbacksRef.current.onRegisterFailed?.(err);
      },

      onKicked: (reason) => {
        callbacksRef.current.onKicked?.(reason);
      },

      onUserListUpdate: setUsers,

      onUserJoined: (user) => {
        setUsers((prev) => {
          if (prev.some((u) => u.user_id === user.user_id)) return prev;
          return [...prev, user];
        });
      },

      onUserLeft: (user) => {
        setUsers((prev) => prev.filter((u) => u.user_id !== user.user_id));
      },

      onDirectMessage: async (msg: IncomingDirectMessage) => {
        await storeMessage({
          odD: msg.from_id,
          direction: "received",
          content: msg.content,
          timestamp: msg.timestamp,
          status: "delivered",
        });
      },

      onRoomCreated: async (room: RoomInfo) => {
        // Only store to IndexedDB if we created this room (we're the creator)
        // For broadcast notifications of public rooms, just update the server rooms list
        const isCreator =
          room.creator_id === callbacksRef.current.currentUserId;
        if (isCreator) {
          await storeRoom({
            roomId: room.room_id,
            name: room.name,
            isPublic: room.is_public,
            creatorId: room.creator_id,
            creatorUsername: room.creator,
            joinedAt: Date.now(),
            lastMessageAt: Date.now(),
            unreadCount: 0,
          });
        }
        // Always add to server rooms list (for Discover view)
        setRooms((prev) => {
          if (prev.some((r) => r.room_id === room.room_id)) return prev;
          return [...prev, room];
        });
      },

      onRoomJoined: async (room: RoomInfo, members: UserInfo[]) => {
        await storeRoom({
          roomId: room.room_id,
          name: room.name,
          isPublic: room.is_public,
          creatorId: room.creator_id,
          creatorUsername: room.creator,
          joinedAt: Date.now(),
          lastMessageAt: Date.now(),
          unreadCount: 0,
        });
        await setRoomMembers(
          room.room_id,
          members.map((m) => ({ odD: m.user_id, username: m.username })),
        );
        setRooms((prev) => {
          if (prev.some((r) => r.room_id === room.room_id)) return prev;
          return [...prev, room];
        });
      },

      onRoomLeft: (roomId: string) => {
        setRooms((prev) => prev.filter((r) => r.room_id !== roomId));
      },

      onRoomJoinFailed: async (error: string, roomId?: string) => {
        // If the room doesn't exist on the server, remove it from local storage
        if (error.includes("not found") && roomId) {
          await deleteRoom(roomId);
          console.log(`Removed stale room ${roomId} from local storage`);
        }
      },

      onRoomMembers: async (roomId, action, user) => {
        if (action === "joined") {
          await addRoomMember(roomId, user.user_id, user.username);
        } else {
          await removeRoomMember(roomId, user.user_id);
        }
      },

      onRoomMessage: async (msg: IncomingRoomMessage) => {
        await storeRoomMessage({
          roomId: msg.room_id,
          messageId: msg.message_id,
          senderId: msg.from_id,
          senderUsername: msg.from,
          content: msg.content,
          timestamp: msg.timestamp,
          isOwn: false, // Will be set correctly when we have current user context
        });
        await incrementUnreadCount(msg.room_id);
      },

      onRoomListUpdate: setRooms,

      onError: (code, message) => {
        setError(`${code}: ${message}`);
      },

      onDirectMessageFailed: (targetUsername) => {
        callbacksRef.current.onDirectMessageFailed?.(targetUsername);
      },
    };

    const service = new WebSocketService(wsUrl, events);
    serviceRef.current = service;

    if (options.autoConnect !== false) {
      service.connect();
    }

    return () => {
      service.disconnect();
    };
  }, []);

  const connect = useCallback(() => {
    serviceRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    serviceRef.current?.disconnect();
  }, []);

  const register = useCallback(
    (username: string, fingerprint: string, recoveryCode?: string) => {
      serviceRef.current?.register(username, fingerprint, recoveryCode);
    },
    [],
  );

  const sendDirectMessage = useCallback(
    async (toUsername: string, toUserId: string, content: string) => {
      serviceRef.current?.sendDirectMessage(toUsername, content);
      // Store sent message locally
      await storeMessage({
        odD: toUserId,
        direction: "sent",
        content,
        timestamp: Date.now(),
        status: "sent",
      });
    },
    [],
  );

  const createRoom = useCallback((name: string, isPublic: boolean) => {
    serviceRef.current?.createRoom(name, isPublic);
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    serviceRef.current?.joinRoom(roomId);
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    serviceRef.current?.leaveRoom(roomId);
  }, []);

  const sendRoomMessage = useCallback((roomId: string, content: string) => {
    serviceRef.current?.sendRoomMessage(roomId, content);
    // Note: The server will echo our message back, so we don't store it here
  }, []);

  const requestUserList = useCallback(() => {
    serviceRef.current?.requestUserList();
  }, []);

  const requestRoomList = useCallback(() => {
    serviceRef.current?.requestRoomList();
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    status,
    users,
    rooms,
    error,
    connect,
    disconnect,
    register,
    sendDirectMessage,
    createRoom,
    joinRoom,
    leaveRoom,
    sendRoomMessage,
    requestUserList,
    requestRoomList,
    clearError,
  };
}
