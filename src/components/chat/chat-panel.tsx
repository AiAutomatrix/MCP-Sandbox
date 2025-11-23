
"use client";

import { useState, useTransition } from "react";
import { useFirestoreSubscription } from "@/hooks/use-firestore-subscription";
import { ChatMessage } from "@/lib/types";
import { sendMessageAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";

export function ChatPanel({ sessionId, userId }: { sessionId: string, userId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const {
    data: messages,
    isLoading,
    error,
  } = useFirestoreSubscription<ChatMessage>(
    ["users", userId, "sessions", sessionId, "messages"],
    "timestamp",
    "asc",
    50
  );

  const handleSendMessage = (message: string) => {
    if (isPending) return;

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
        messages={messages}
        isLoading={isLoading}
        isThinking={isPending}
      />
      <ChatInput onSendMessage={handleSendMessage} isLoading={isPending} />
    </div>
  );
}
