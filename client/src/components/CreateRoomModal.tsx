import { useState } from 'react';

interface CreateRoomModalProps {
  onClose: () => void;
  onCreate: (name: string, isPublic: boolean) => void;
}

export default function CreateRoomModal({ onClose, onCreate }: CreateRoomModalProps) {
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName) {
      onCreate(trimmedName, isPublic);
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '400px' }}>
        <h2 style={{ marginBottom: '1rem' }}>Create Room</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Room Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter room name"
              autoFocus
              style={{ width: '100%' }}
              maxLength={50}
            />
          </div>

          <div>
            <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              <span>Public room</span>
            </label>
            <p className="text-small text-muted" style={{ marginTop: '0.25rem', marginLeft: '1.5rem' }}>
              {isPublic ? 'Anyone can discover and join this room' : 'Only people with the room ID can join'}
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={!name.trim()}>
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
