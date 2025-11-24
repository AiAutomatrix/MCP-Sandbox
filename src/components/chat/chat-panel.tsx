
"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { ChatMessage } from "@/lib/types";
import { sendMessageAction } from "@/app/actions";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { collection, query, orderBy, limit } from "firebase/firestore";


export function ChatPanel({ sessionId, userId }: { sessionId: string, userId: string }) {
  const [isPending, startTransition] = useTransition();
  const db = useFirestore();

  // Local state for optimistic UI updates (now only for assistant messages)
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);

  const messagesQuery = useMemoFirebase(() => {
    if (!userId || !sessionId) return null;
    return query(
      collection(db, "users", userId, "sessions", sessionId, "messages"),
      orderBy("timestamp", "asc"),
      limit(50)
    );
  }, [db, userId, sessionId]);

  const {
    data: firestoreMessages,
    isLoading,
    error,
  } = useCollection<ChatMessage>(messagesQuery);

  // Combine firestore messages with optimistic messages, filtering out duplicates
  const messages = useMemo(() => {
    const combined = [
      ...(firestoreMessages || []),
      ...optimisticMessages.filter(
        (optMsg) => !firestoreMessages?.some((fsMsg) => fsMsg.id === optMsg.id)
      ),
    ];
  
    // Final sort to ensure chronological order
    return combined.sort((a, b) => {
        const timeA = a.timestamp?.toMillis() || 0;
        const timeB = b.timestamp?.toMillis() || 0;
        return timeA - timeB;
    });
  }, [firestoreMessages, optimisticMessages]);


  useEffect(() => {
    // When session changes, clear optimistic messages
    setOptimisticMessages([]);
  }, [sessionId]);


  const handleSendMessage = (message: string) => {
    if (isPending || !userId) return;

    startTransition(async () => {
      // The `sendMessageAction` has its own internal try/catch and will return
      // a user-facing error message if something fails on the server.
      // There's no need for a client-side try/catch here.
      const assistantResponse = await sendMessageAction(sessionId, message, userId);
      
      // Optimistically add the assistant's response to the UI
      setOptimisticMessages(prev => [...prev, assistantResponse]);
    });
  };

  return (
    <div className="flex flex-col flex-1 h-full max-h-full">
      <ChatMessages
        messages={messages || []}
        isLoading={isLoading && !messages?.length} // Only show skeleton on initial load
        isThinking={isPending}
      />
      <ChatInput onSendMessage={handleSendMessage} isLoading={isPending} />
    </div>
  );
}
