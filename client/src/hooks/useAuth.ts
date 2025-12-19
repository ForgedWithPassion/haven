import { useState, useEffect, useCallback } from 'react';
import { getDatabase, type LocalProfile } from '../storage/schema';

export interface AuthState {
  isLoading: boolean;
  isLoggedIn: boolean;
  userId: string | null;
  username: string | null;
  recoveryCode: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isLoggedIn: false,
    userId: null,
    username: null,
    recoveryCode: null,
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const db = getDatabase();
        const profile = await db.profile.get('current');
        if (profile) {
          setState({
            isLoading: false,
            isLoggedIn: true,
            userId: profile.odD,
            username: profile.username,
            recoveryCode: profile.recoveryCode || null,
          });
        } else {
          setState({
            isLoading: false,
            isLoggedIn: false,
            userId: null,
            username: null,
            recoveryCode: null,
          });
        }
      } catch (e) {
        console.error('Failed to load profile:', e);
        setState({
          isLoading: false,
          isLoggedIn: false,
          userId: null,
          username: null,
          recoveryCode: null,
        });
      }
    };

    loadProfile();
  }, []);

  const login = useCallback(async (userId: string, username: string, recoveryCode?: string) => {
    const db = getDatabase();
    // Get existing profile to preserve recovery code if not provided
    const existing = await db.profile.get('current');
    const profile: LocalProfile = {
      id: 'current',
      odD: userId,
      username,
      createdAt: existing?.createdAt || Date.now(),
      recoveryCode: recoveryCode || existing?.recoveryCode,
    };
    await db.profile.put(profile);
    setState({
      isLoading: false,
      isLoggedIn: true,
      userId,
      username,
      recoveryCode: profile.recoveryCode || null,
    });
  }, []);

  const logout = useCallback(async () => {
    const db = getDatabase();
    await db.profile.delete('current');
    setState({
      isLoading: false,
      isLoggedIn: false,
      userId: null,
      username: null,
      recoveryCode: null,
    });
  }, []);

  return { ...state, login, logout };
}
