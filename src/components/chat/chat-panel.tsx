
"use client";

import { useState, useTransition, useMemo } from "react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { ChatMessage } from "@/lib/types";
import { sendMessageAction } from "@/app/actions";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { collection, query, orderBy, limit, Timestamp } from "firebase/firestore";


export function ChatPanel({ sessionId, userId }: { sessionId: string, userId: string }) {
  const [isPending, startTransition] = useTransition();
  const db = useFirestore();

  const messagesQuery = useMemoFirebase(() => {
    if (!userId || !sessionId) return null;
    return query(
      collection(db, "users", userId, "sessions", sessionId, "messages"),
      orderBy("timestamp", "asc"),
      limit(50)
    );
  }, [db, userId, sessionId]);

  const {
    data: messages,
    isLoading,
    error,
  } = useCollection<ChatMessage>(messagesQuery);

  const handleSendMessage = (message: string) => {
    if (isPending || !userId) return;

    startTransition(async () => {
      // The action now handles saving both user and assistant messages.
      // It no longer returns a value, preventing the serialization error.
      await sendMessageAction(sessionId, message, userId);
    });
  };

  const sortedMessages = useMemo(() => {
    if (!messages) return [];
    // Firestore's query already orders by timestamp, but a client-side sort
    // is a good safeguard if we ever introduce optimistic updates again.
    return messages.sort((a, b) => {
        const timeA = a.timestamp instanceof Timestamp ? a.timestamp.toMillis() : a.timestamp ? (a.timestamp as any).seconds * 1000 : 0;
        const timeB = b.timestamp instanceof Timestamp ? b.timestamp.toMillis() : b.timestamp ? (b.timestamp as any).seconds * 1000 : 0;
        return timeA - timeB;
    });
  }, [messages]);


  return (
    <div className="flex flex-col flex-1 h-full max-h-full">
      <ChatMessages
        messages={sortedMessages}
        isLoading={isLoading && !messages?.length} // Only show skeleton on initial load
        isThinking={isPending}
      />
      <ChatInput onSendMessage={handleSendMessage} isLoading={isPending} />
    </div>
  );
}
