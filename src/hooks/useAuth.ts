// hooks/useAuth.ts
'use client';

import { useState, useEffect } from 'react';
import { GitHubAuthUser } from '@/types/github';

export interface AuthState {
  user: GitHubAuthUser | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/session');

      if (response.ok) {
        const data = await response.json();
        setState({
          user: data.user,
          loading: false,
          error: null,
        });
      } else {
        setState({
          user: null,
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Session check failed:', error);
      }
      setState({
        user: null,
        loading: false,
        error: 'Failed to check session',
      });
    }
  };

  const signOut = async () => {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'DELETE',
      });

      if (response.ok) {
        setState({
          user: null,
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Sign-out failed:', error);
      }
      setState(prev => ({
        ...prev,
        error: 'Failed to sign out',
      }));
    }
  };

  const signInWithGitHub = () => {
    window.location.href = '/api/auth/github';
  };

  return {
    ...state,
    signOut,
    signInWithGitHub,
    checkSession,
  };
}
