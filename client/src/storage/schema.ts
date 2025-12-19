import Dexie, { type Table } from "dexie";

// User record (cached online users)
export interface User {
  odD: string; // Primary key - server-assigned ID
  username: string;
  lastSeen: number;
}

// Direct message record
export interface Message {
  id?: number; // Auto-increment
  odD: string; // Other user's ID (index)
  direction: "sent" | "received";
  content: string;
  timestamp: number;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
}

// Room record
export interface Room {
  roomId: string; // Primary key
  name: string;
  isPublic: boolean;
  creatorId: string;
  creatorUsername: string;
  joinedAt: number;
  lastMessageAt: number;
  unreadCount: number;
}

// Room message record
export interface RoomMessage {
  id?: number; // Auto-increment
  roomId: string; // Index
  messageId: string; // UUID for deduplication
  senderId: string;
  senderUsername: string;
  content: string;
  timestamp: number;
  isOwn: boolean;
}

// Room member record
export interface RoomMember {
  id?: number;
  roomId: string;
  odD: string;
  username: string;
}

// Local profile
export interface LocalProfile {
  id: "current"; // Singleton key
  odD: string;
  username: string;
  createdAt: number;
  recoveryCode?: string; // Stored for settings display
}

// Database class
export class HavenDatabase extends Dexie {
  users!: Table<User, string>;
  messages!: Table<Message, number>;
  rooms!: Table<Room, string>;
  roomMessages!: Table<RoomMessage, number>;
  roomMembers!: Table<RoomMember, number>;
  profile!: Table<LocalProfile, string>;

  constructor() {
    super("haven");

    this.version(1).stores({
      users: "odD, username, lastSeen",
      messages: "++id, odD, timestamp, [odD+timestamp]",
      rooms: "roomId, isPublic, lastMessageAt",
      roomMessages: "++id, roomId, messageId, timestamp, [roomId+timestamp]",
      roomMembers: "++id, roomId, odD, [roomId+odD]",
      profile: "id",
    });

    // Version 2: Add recoveryCode to profile (no index changes needed)
    this.version(2).stores({});
  }
}

let dbInstance: HavenDatabase | null = null;

export function getDatabase(): HavenDatabase {
  if (!dbInstance) {
    dbInstance = new HavenDatabase();
  }
  return dbInstance;
}

export async function clearAllData(): Promise<void> {
  const db = getDatabase();
  await db.transaction(
    "rw",
    [
      db.users,
      db.messages,
      db.rooms,
      db.roomMessages,
      db.roomMembers,
      db.profile,
    ],
    async () => {
      await db.users.clear();
      await db.messages.clear();
      await db.rooms.clear();
      await db.roomMessages.clear();
      await db.roomMembers.clear();
      await db.profile.clear();
    },
  );
}
