import {
  type Envelope,
  type MessageType,
  type RegisterAckPayload,
  type KickedPayload,
  type UserJoinedPayload,
  type UserLeftPayload,
  type RoomCreatedPayload,
  type RoomJoinedPayload,
  type RoomLeftPayload,
  type RoomMembersPayload,
  type IncomingDirectMessage,
  type IncomingRoomMessage,
  type UserListResponsePayload,
  type RoomListResponsePayload,
  type ErrorPayload,
  type UserInfo,
  type RoomInfo,
  createEnvelope,
} from './protocol';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'registered';

export interface WebSocketEvents {
  onStatusChange?: (status: ConnectionStatus) => void;
  onRegistered?: (userId: string, username: string, recoveryCode?: string, isNewUser?: boolean) => void;
  onRegisterFailed?: (error: string) => void;
  onKicked?: (reason: string) => void;
  onUserListUpdate?: (users: UserInfo[]) => void;
  onUserJoined?: (user: UserInfo) => void;
  onUserLeft?: (user: UserInfo) => void;
  onDirectMessage?: (message: IncomingDirectMessage) => void;
  onRoomCreated?: (room: RoomInfo) => void;
  onRoomCreateFailed?: (error: string) => void;
  onRoomJoined?: (room: RoomInfo, members: UserInfo[]) => void;
  onRoomJoinFailed?: (error: string, roomId?: string) => void;
  onRoomLeft?: (roomId: string) => void;
  onRoomMembers?: (roomId: string, action: 'joined' | 'left', user: UserInfo, members: UserInfo[]) => void;
  onRoomMessage?: (message: IncomingRoomMessage) => void;
  onRoomListUpdate?: (rooms: RoomInfo[]) => void;
  onError?: (code: string, message: string, target?: string) => void;
  onDirectMessageFailed?: (targetUsername: string) => void;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private events: WebSocketEvents;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private shouldReconnect = true;
  private status: ConnectionStatus = 'disconnected';

  constructor(url: string, events: WebSocketEvents = {}) {
    this.url = url;
    this.events = events;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.shouldReconnect = true;
    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data) as Envelope;
          this.handleMessage(envelope);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = () => {
        this.events.onError?.('CONNECTION_ERROR', 'WebSocket connection error');
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      this.setStatus('disconnected');
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      // Only close if actually open to avoid "closed before established" warning
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  // Registration
  register(username: string, fingerprint: string, recoveryCode?: string): void {
    this.send('register', { username, fingerprint, recovery_code: recoveryCode });
  }

  // Direct messaging
  sendDirectMessage(toUsername: string, content: string): void {
    this.send('direct_message', { to: toUsername, content });
  }

  // Room operations
  createRoom(name: string, isPublic: boolean): void {
    this.send('room_create', { name, is_public: isPublic });
  }

  joinRoom(roomId: string): void {
    this.send('room_join', { room_id: roomId });
  }

  leaveRoom(roomId: string): void {
    this.send('room_leave', { room_id: roomId });
  }

  sendRoomMessage(roomId: string, content: string): void {
    this.send('room_message', { room_id: roomId, content });
  }

  // List requests
  requestUserList(): void {
    this.send('user_list', {});
  }

  requestRoomList(): void {
    this.send('room_list', {});
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.events.onStatusChange?.(status);
  }

  private send(type: MessageType, payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const envelope = createEnvelope(type, payload);
      this.ws.send(JSON.stringify(envelope));
    }
  }

  private handleMessage(envelope: Envelope): void {
    switch (envelope.type) {
      case 'register_ack': {
        const payload = envelope.payload as RegisterAckPayload;
        if (payload.success && payload.user_id && payload.username) {
          this.setStatus('registered');
          this.events.onRegistered?.(payload.user_id, payload.username, payload.recovery_code, payload.is_new_user);
        } else {
          this.events.onRegisterFailed?.(payload.error || 'Registration failed');
        }
        break;
      }

      case 'kicked': {
        const payload = envelope.payload as KickedPayload;
        this.events.onKicked?.(payload.reason);
        this.disconnect();
        break;
      }

      case 'user_joined': {
        const payload = envelope.payload as UserJoinedPayload;
        this.events.onUserJoined?.({ user_id: payload.user_id, username: payload.username });
        break;
      }

      case 'user_left': {
        const payload = envelope.payload as UserLeftPayload;
        this.events.onUserLeft?.({ user_id: payload.user_id, username: payload.username });
        break;
      }

      case 'user_list_response': {
        const payload = envelope.payload as UserListResponsePayload;
        this.events.onUserListUpdate?.(payload.users);
        break;
      }

      case 'direct_message': {
        const payload = envelope.payload as IncomingDirectMessage;
        this.events.onDirectMessage?.(payload);
        break;
      }

      case 'room_created': {
        const payload = envelope.payload as RoomCreatedPayload;
        if (payload.success && payload.room) {
          this.events.onRoomCreated?.(payload.room);
        } else {
          this.events.onRoomCreateFailed?.(payload.error || 'Room creation failed');
        }
        break;
      }

      case 'room_joined': {
        const payload = envelope.payload as RoomJoinedPayload;
        if (payload.success && payload.room) {
          this.events.onRoomJoined?.(payload.room, payload.members || []);
        } else {
          this.events.onRoomJoinFailed?.(payload.error || 'Join failed', payload.room_id);
        }
        break;
      }

      case 'room_left': {
        const payload = envelope.payload as RoomLeftPayload;
        if (payload.success) {
          this.events.onRoomLeft?.(payload.room_id);
        }
        break;
      }

      case 'room_members': {
        const payload = envelope.payload as RoomMembersPayload;
        this.events.onRoomMembers?.(payload.room_id, payload.action, payload.user, payload.members);
        break;
      }

      case 'room_message': {
        const payload = envelope.payload as IncomingRoomMessage;
        this.events.onRoomMessage?.(payload);
        break;
      }

      case 'room_list_response': {
        const payload = envelope.payload as RoomListResponsePayload;
        this.events.onRoomListUpdate?.(payload.rooms);
        break;
      }

      case 'error': {
        const payload = envelope.payload as ErrorPayload;
        // Handle DM send failures specially
        if (payload.code === 'USER_NOT_FOUND' && payload.target) {
          this.events.onDirectMessageFailed?.(payload.target);
        } else {
          this.events.onError?.(payload.code, payload.message, payload.target);
        }
        break;
      }
    }
  }

  private attemptReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.events.onError?.('MAX_RECONNECT', 'Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect();
      }
    }, delay);
  }
}

// Singleton instance
let instance: WebSocketService | null = null;

export function getWebSocketService(): WebSocketService {
  if (!instance) {
    const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:9088/ws`;
    instance = new WebSocketService(wsUrl);
  }
  return instance;
}

export function setWebSocketEvents(events: WebSocketEvents): void {
  const service = getWebSocketService();
  // Update events by reconnecting with new events
  // This is a simplified approach - a more robust solution would update events in place
  Object.assign(service['events'], events);
}
