
"use client";

import { useState, useTransition } from "react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { ChatMessage } from "@/lib/types";
import { sendMessageAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { collection, query, orderBy, limit } from "firebase/firestore";


export function ChatPanel({ sessionId, userId }: { sessionId: string, userId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
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
      const result = await sendMessageAction(sessionId, message, userId);
      if (result.id === "error") {
        toast({
          variant: "destructive",
          title: "An error occurred",
          description: result.content,
        });
      }
    });
  };

  return (
    <div className="flex flex-col flex-1 h-full max-h-full">
      <ChatMessages
        messages={messages || []}
        isLoading={isLoading}
        isThinking={isPending}
      />
      <ChatInput onSendMessage={handleSendMessage} isLoading={isPending} />
    </div>
  );
}
