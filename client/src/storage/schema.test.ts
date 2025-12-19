import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase, clearAllData, type Message, type Room, type RoomMessage } from './schema';

describe('HavenDatabase', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  describe('messages table', () => {
    it('stores and retrieves messages', async () => {
      const db = getDatabase();
      const message: Omit<Message, 'id'> = {
        odD: 'user-123',
        direction: 'sent',
        content: 'Hello!',
        timestamp: Date.now(),
        status: 'sent',
      };

      const id = await db.messages.add(message as Message);
      const stored = await db.messages.get(id);

      expect(stored).toBeDefined();
      expect(stored?.content).toBe('Hello!');
      expect(stored?.direction).toBe('sent');
    });

    it('queries messages by user ID', async () => {
      const db = getDatabase();
      const now = Date.now();

      await db.messages.bulkAdd([
        { odD: 'user-1', direction: 'sent', content: 'A', timestamp: now, status: 'sent' },
        { odD: 'user-2', direction: 'sent', content: 'B', timestamp: now, status: 'sent' },
        { odD: 'user-1', direction: 'received', content: 'C', timestamp: now + 1, status: 'delivered' },
      ] as Message[]);

      const user1Messages = await db.messages.where('odD').equals('user-1').toArray();
      expect(user1Messages).toHaveLength(2);
    });
  });

  describe('rooms table', () => {
    it('stores and retrieves rooms', async () => {
      const db = getDatabase();
      const room: Room = {
        roomId: 'room-123',
        name: 'General',
        isPublic: true,
        creatorId: 'user-1',
        creatorUsername: 'alice',
        joinedAt: Date.now(),
        lastMessageAt: Date.now(),
        unreadCount: 0,
      };

      await db.rooms.put(room);
      const stored = await db.rooms.get('room-123');

      expect(stored).toBeDefined();
      expect(stored?.name).toBe('General');
      expect(stored?.isPublic).toBe(true);
    });

    it('updates room properties', async () => {
      const db = getDatabase();
      await db.rooms.put({
        roomId: 'room-1',
        name: 'Test',
        isPublic: false,
        creatorId: 'user-1',
        creatorUsername: 'bob',
        joinedAt: Date.now(),
        lastMessageAt: Date.now(),
        unreadCount: 0,
      });

      await db.rooms.update('room-1', { unreadCount: 5 });
      const updated = await db.rooms.get('room-1');

      expect(updated?.unreadCount).toBe(5);
    });
  });

  describe('roomMessages table', () => {
    it('stores room messages with deduplication', async () => {
      const db = getDatabase();
      const message: Omit<RoomMessage, 'id'> = {
        roomId: 'room-1',
        messageId: 'msg-uuid-1',
        senderId: 'user-1',
        senderUsername: 'alice',
        content: 'Hello room!',
        timestamp: Date.now(),
        isOwn: false,
      };

      const id1 = await db.roomMessages.add(message as RoomMessage);

      // Check if duplicate exists before adding
      const existing = await db.roomMessages.where('messageId').equals('msg-uuid-1').first();
      expect(existing).toBeDefined();
      expect(existing?.id).toBe(id1);
    });

    it('queries messages by room ID', async () => {
      const db = getDatabase();
      const now = Date.now();

      await db.roomMessages.bulkAdd([
        { roomId: 'room-1', messageId: 'a', senderId: 'u1', senderUsername: 'a', content: 'A', timestamp: now, isOwn: false },
        { roomId: 'room-2', messageId: 'b', senderId: 'u2', senderUsername: 'b', content: 'B', timestamp: now, isOwn: false },
        { roomId: 'room-1', messageId: 'c', senderId: 'u3', senderUsername: 'c', content: 'C', timestamp: now + 1, isOwn: true },
      ] as RoomMessage[]);

      const room1Messages = await db.roomMessages.where('roomId').equals('room-1').toArray();
      expect(room1Messages).toHaveLength(2);
    });
  });

  describe('profile table', () => {
    it('stores singleton profile', async () => {
      const db = getDatabase();
      await db.profile.put({
        id: 'current',
        odD: 'user-123',
        username: 'testuser',
        createdAt: Date.now(),
      });

      const profile = await db.profile.get('current');
      expect(profile?.username).toBe('testuser');
    });
  });
});
