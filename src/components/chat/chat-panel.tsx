
"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { ChatMessage } from "@/lib/types";
import { sendMessageAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { collection, query, orderBy, limit, Timestamp } from "firebase/firestore";


export function ChatPanel({ sessionId, userId }: { sessionId: string, userId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const db = useFirestore();

  // Local state for optimistic UI updates
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

  // Combine firestore messages with optimistic messages
  const messages = useMemo(() => {
    if (!firestoreMessages) return optimisticMessages;
    // Filter out optimistic messages that are now confirmed in Firestore
    const confirmedIds = new Set(firestoreMessages.map(m => m.id));
    const uniqueOptimistic = optimisticMessages.filter(m => !confirmedIds.has(m.id));
    return [...firestoreMessages, ...uniqueOptimistic];
  }, [firestoreMessages, optimisticMessages]);


  useEffect(() => {
    // When session changes, clear optimistic messages
    setOptimisticMessages([]);
  }, [sessionId]);


  const handleSendMessage = (message: string) => {
    if (isPending || !userId) return;
    
    // Optimistically add user message to the UI
    const optimisticUserId = `user-${Date.now()}`;
    const newUserMessage: ChatMessage = {
      id: optimisticUserId,
      role: 'user',
      content: message,
      timestamp: Timestamp.now()
    };
    setOptimisticMessages(prev => [...prev, newUserMessage]);


    startTransition(async () => {
      try {
        const assistantResponse = await sendMessageAction(sessionId, message, userId);
        // Add assistant's response to the optimistic list
        setOptimisticMessages(prev => [...prev, assistantResponse]);
      } catch (error) {
         toast({
          variant: "destructive",
          title: "An error occurred",
          description: "Failed to send message.",
        });
        // Remove the optimistic user message if the action fails
        setOptimisticMessages(prev => prev.filter(m => m.id !== optimisticUserId));
      }
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
