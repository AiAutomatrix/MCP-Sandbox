"use client";

import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

const SESSION_KEY = "gemini_sandbox_session_id";

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      let storedSessionId = localStorage.getItem(SESSION_KEY);
      if (!storedSessionId) {
        storedSessionId = uuidv4();
        localStorage.setItem(SESSION_KEY, storedSessionId);
      }
      setSessionId(storedSessionId);
    } catch (error) {
      console.error("Could not access localStorage:", error);
      // Fallback for environments where localStorage is not available
      if (!sessionId) {
        setSessionId(uuidv4());
      }
    } finally {
      setIsLoaded(true);
    }
  }, []);

  return { sessionId, isLoaded };
}
