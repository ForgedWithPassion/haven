// Message types matching the Go relay server protocol

export type MessageType =
  // Client -> Server
  | "register"
  | "direct_message"
  | "room_create"
  | "room_join"
  | "room_leave"
  | "room_message"
  | "user_list"
  | "room_list"
  // Server -> Client
  | "register_ack"
  | "kicked"
  | "user_joined"
  | "user_left"
  | "room_created"
  | "room_joined"
  | "room_left"
  | "room_members"
  | "user_list_response"
  | "room_list_response"
  | "error";

// Error codes
export const ERR_RECOVERY_REQUIRED = "RECOVERY_REQUIRED";
export const ERR_INVALID_RECOVERY = "INVALID_RECOVERY";

// Envelope wraps all messages
export interface Envelope {
  type: MessageType;
  payload: unknown;
  timestamp: number;
}

// ==================== Client -> Server Messages ====================

export interface RegisterPayload {
  username: string;
  fingerprint?: string;
  recovery_code?: string;
}

export interface DirectMessagePayload {
  to: string; // Target username
  content: string;
}

export interface RoomCreatePayload {
  name: string;
  is_public: boolean;
}

export interface RoomJoinPayload {
  room_id: string;
}

export interface RoomLeavePayload {
  room_id: string;
}

export interface RoomMessagePayload {
  room_id: string;
  content: string;
}

// ==================== Server -> Client Messages ====================

export interface RegisterAckPayload {
  success: boolean;
  username?: string;
  user_id?: string;
  recovery_code?: string;
  is_new_user?: boolean;
  error?: string;
}

export interface KickedPayload {
  reason: string;
}

export interface UserJoinedPayload {
  user_id: string;
  username: string;
}

export interface UserLeftPayload {
  user_id: string;
  username: string;
}

export interface RoomCreatedPayload {
  success: boolean;
  room?: RoomInfo;
  error?: string;
}

export interface RoomJoinedPayload {
  success: boolean;
  room_id?: string; // Always included, even on failure
  room?: RoomInfo;
  members?: UserInfo[];
  history?: IncomingRoomMessage[]; // Recent message history
  error?: string;
}

export interface RoomLeftPayload {
  success: boolean;
  room_id: string;
  error?: string;
}

export interface RoomMembersPayload {
  room_id: string;
  action: "joined" | "left";
  user: UserInfo;
  members: UserInfo[];
}

export interface IncomingDirectMessage {
  message_id: string;
  from: string; // Username
  from_id: string; // User ID
  content: string;
  timestamp: number;
}

export interface IncomingRoomMessage {
  message_id: string;
  room_id: string;
  from: string; // Username
  from_id: string; // User ID
  content: string;
  timestamp: number;
}

export interface UserListResponsePayload {
  users: UserInfo[];
}

export interface RoomListResponsePayload {
  rooms: RoomInfo[];
}

export interface ErrorPayload {
  code: string;
  message: string;
  target?: string; // Target username for DM errors
}

// ==================== Shared Types ====================

export interface UserInfo {
  user_id: string;
  username: string;
}

export interface RoomInfo {
  room_id: string;
  name: string;
  creator: string;
  creator_id: string;
  member_count: number;
  is_public: boolean;
}

// ==================== Helper Functions ====================

export function createEnvelope(type: MessageType, payload: unknown): Envelope {
  return {
    type,
    payload,
    timestamp: Date.now(),
  };
}
