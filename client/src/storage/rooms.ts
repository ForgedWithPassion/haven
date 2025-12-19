import {
  getDatabase,
  type Room,
  type RoomMessage,
  type RoomMember,
} from "./schema";

// Room operations
export async function storeRoom(room: Room): Promise<void> {
  const db = getDatabase();
  await db.rooms.put(room);
}

export async function getRoom(roomId: string): Promise<Room | undefined> {
  const db = getDatabase();
  return db.rooms.get(roomId);
}

export async function getJoinedRooms(): Promise<Room[]> {
  const db = getDatabase();
  return db.rooms.orderBy("lastMessageAt").reverse().toArray();
}

export async function updateRoomLastMessage(
  roomId: string,
  timestamp: number,
): Promise<void> {
  const db = getDatabase();
  await db.rooms.update(roomId, { lastMessageAt: timestamp });
}

export async function incrementUnreadCount(roomId: string): Promise<void> {
  const db = getDatabase();
  const room = await db.rooms.get(roomId);
  if (room) {
    await db.rooms.update(roomId, { unreadCount: room.unreadCount + 1 });
  }
}

export async function resetUnreadCount(roomId: string): Promise<void> {
  const db = getDatabase();
  await db.rooms.update(roomId, { unreadCount: 0 });
}

export async function deleteRoom(roomId: string): Promise<void> {
  const db = getDatabase();
  await db.transaction(
    "rw",
    [db.rooms, db.roomMessages, db.roomMembers],
    async () => {
      await db.rooms.delete(roomId);
      await db.roomMessages.where("roomId").equals(roomId).delete();
      await db.roomMembers.where("roomId").equals(roomId).delete();
    },
  );
}

// Room message operations
export async function storeRoomMessage(
  message: Omit<RoomMessage, "id">,
): Promise<number> {
  const db = getDatabase();

  // Check for duplicate (by messageId)
  const existing = await db.roomMessages
    .where("messageId")
    .equals(message.messageId)
    .first();
  if (existing) {
    return existing.id!;
  }

  const id = await db.roomMessages.add(message as RoomMessage);

  // Update room's last message timestamp
  await updateRoomLastMessage(message.roomId, message.timestamp);

  return id;
}

export async function getRoomMessages(
  roomId: string,
  limit = 100,
): Promise<RoomMessage[]> {
  const db = getDatabase();
  return db.roomMessages
    .where("[roomId+timestamp]")
    .between([roomId, 0], [roomId, Date.now()], true, true)
    .reverse()
    .limit(limit)
    .toArray()
    .then((msgs) => msgs.reverse());
}

export async function clearRoomMessages(roomId: string): Promise<void> {
  const db = getDatabase();
  await db.roomMessages.where("roomId").equals(roomId).delete();
}

// Room member operations
export async function setRoomMembers(
  roomId: string,
  members: Array<{ odD: string; username: string }>,
): Promise<void> {
  const db = getDatabase();
  await db.transaction("rw", db.roomMembers, async () => {
    // Clear existing members
    await db.roomMembers.where("roomId").equals(roomId).delete();
    // Add new members
    await db.roomMembers.bulkAdd(
      members.map((m) => ({
        roomId,
        odD: m.odD,
        username: m.username,
      })),
    );
  });
}

export async function getRoomMembers(roomId: string): Promise<RoomMember[]> {
  const db = getDatabase();
  return db.roomMembers.where("roomId").equals(roomId).toArray();
}

export async function addRoomMember(
  roomId: string,
  odD: string,
  username: string,
): Promise<void> {
  const db = getDatabase();
  const existing = await db.roomMembers
    .where("[roomId+odD]")
    .equals([roomId, odD])
    .first();
  if (!existing) {
    await db.roomMembers.add({ roomId, odD, username });
  }
}

export async function removeRoomMember(
  roomId: string,
  odD: string,
): Promise<void> {
  const db = getDatabase();
  await db.roomMembers.where("[roomId+odD]").equals([roomId, odD]).delete();
}
