
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

  // Combine firestore messages with optimistic messages, filtering out duplicates
  const messages = useMemo(() => {
    const optimisticIds = new Set(optimisticMessages.map(m => m.id));
    const combined = [
      ...(firestoreMessages?.filter(m => !optimisticIds.has(m.id)) || []),
      ...optimisticMessages
    ];

    // Final sort to ensure chronological order
    return combined.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
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
        
        // Replace the optimistic user message with the real one and add the assistant's response
        // This is important for when the real-time listener is slow or fails
        setOptimisticMessages(prev => {
           // Filter out the temporary user message and add the assistant's response.
           // The user's real message will come from the Firestore listener.
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
