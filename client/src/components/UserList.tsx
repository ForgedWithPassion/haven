import { type UserInfo } from '../services/protocol';

interface UserListProps {
  users: UserInfo[];
  currentUserId: string | null;
  onSelectUser: (user: UserInfo) => void;
}

export default function UserList({ users, currentUserId, onSelectUser }: UserListProps) {
  // Filter out current user
  const otherUsers = users.filter((u) => u.user_id !== currentUserId);

  if (otherUsers.length === 0) {
    return (
      <div className="text-center text-muted" style={{ padding: '2rem' }}>
        <p>No other users online</p>
        <p className="text-small" style={{ marginTop: '0.5rem' }}>
          Share Haven with friends to start chatting
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <h3 style={{ padding: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
        Online Users ({otherUsers.length})
      </h3>
      {otherUsers.map((user) => (
        <div key={user.user_id} className="peer-item" onClick={() => onSelectUser(user)}>
          <div className="peer-avatar">{user.username.charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div>{user.username}</div>
          </div>
          <span className="status-dot status-online" />
        </div>
      ))}
    </div>
  );
}
