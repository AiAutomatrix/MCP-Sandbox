'use client';

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useUser } from '@/firebase';

const SESSION_KEY_PREFIX = 'gemini_sandbox_session_id_';

export function useSession() {
  const { user } = useUser();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsLoaded(false);
      setSessionId(null);
      return;
    }

    try {
      const sessionKey = `${SESSION_KEY_PREFIX}${user.uid}`;
      let storedSessionId = localStorage.getItem(sessionKey);
      if (!storedSessionId) {
        storedSessionId = uuidv4();
        localStorage.setItem(sessionKey, storedSessionId);
      }
      setSessionId(storedSessionId);
    } catch (error) {
      console.error('Could not access localStorage:', error);
      // Fallback for environments where localStorage is not available
      if (!sessionId) {
        setSessionId(uuidv4());
      }
    } finally {
      setIsLoaded(true);
    }
  }, [user, sessionId]);

  const createNewSession = useCallback(() => {
    if (!user) return;
    try {
      const sessionKey = `${SESSION_KEY_PREFIX}${user.uid}`;
      const newSessionId = uuidv4();
      localStorage.setItem(sessionKey, newSessionId);
      setSessionId(newSessionId);

      // We need to reload the page to force all components to re-query with the new session ID
      window.location.reload();
    } catch (error) {
      console.error('Could not create new session in localStorage:', error);
    }
  }, [user]);

  return { sessionId, isLoaded, createNewSession };
}
