
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
    const combined = [...(firestoreMessages || [])];
    const firestoreIds = new Set(combined.map(m => m.id));
    
    optimisticMessages.forEach(optMsg => {
      // Find if an optimistic message's placeholder ID is already represented
      // by a real ID from firestore. This is not perfect but covers user messages.
      // A more robust solution might involve mapping placeholder IDs to real IDs.
      if (!firestoreIds.has(optMsg.id)) {
        combined.push(optMsg);
      }
    });

    // Final filter for any duplicates that might have slipped through
    const uniqueMessages = Array.from(new Map(combined.map(m => [m.id, m])).values());

    return uniqueMessages.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
  }, [firestoreMessages, optimisticMessages]);


  useEffect(() => {
    // When session changes, clear optimistic messages
    setOptimisticMessages([]);
  }, [sessionId]);


  const handleSendMessage = (message: string) => {
    if (isPending || !userId) return;
    
    // Optimistically add user message to the UI
    const optimisticUserMessage: ChatMessage = {
      id: `optimistic-user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Timestamp.now()
    };
    
    setOptimisticMessages(prev => [...prev, optimisticUserMessage]);

    startTransition(async () => {
      try {
        const assistantResponse = await sendMessageAction(sessionId, message, userId);
        
        // Remove the optimistic user message and add the real one + the assistant's response
        setOptimisticMessages(prev => {
          const newOptimisticList = prev.filter(m => m.id !== optimisticUserMessage.id);
          newOptimisticList.push(assistantResponse);
          return newOptimisticList;
        });

      } catch (error) {
         toast({
          variant: "destructive",
          title: "An error occurred",
          description: "Failed to send message.",
        });
        // Remove the optimistic user message if the action fails
        setOptimisticMessages(prev => prev.filter(m => m.id !== optimisticUserMessage.id));
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

