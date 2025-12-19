import { useState, useEffect, useCallback } from "react";
import {
  getJoinedRooms,
  getRoom,
  getRoomMessages,
  getRoomMembers,
  resetUnreadCount,
  deleteRoom as deleteRoomStorage,
  type Room,
  type RoomMessage,
  type RoomMember,
} from "../storage";

export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const r = await getJoinedRooms();
      setRooms(r);
    } catch (e) {
      console.error("Failed to load rooms:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const refresh = useCallback(() => {
    loadRooms();
  }, [loadRooms]);

  const deleteRoom = useCallback(async (roomId: string) => {
    await deleteRoomStorage(roomId);
    setRooms((prev) => prev.filter((r) => r.roomId !== roomId));
  }, []);

  return { rooms, isLoading, refresh, deleteRoom };
}

export function useRoom(roomId: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadRoom = useCallback(async () => {
    if (!roomId) {
      setRoom(null);
      setMessages([]);
      setMembers([]);
      return;
    }

    setIsLoading(true);
    try {
      const [r, msgs, mems] = await Promise.all([
        getRoom(roomId),
        getRoomMessages(roomId),
        getRoomMembers(roomId),
      ]);
      setRoom(r || null);
      setMessages(msgs);
      setMembers(mems);

      // Reset unread count when viewing room
      if (r) {
        await resetUnreadCount(roomId);
      }
    } catch (e) {
      console.error("Failed to load room:", e);
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  const refresh = useCallback(() => {
    loadRoom();
  }, [loadRoom]);

  return { room, messages, members, isLoading, refresh };
}
