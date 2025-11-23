"use client";

import { useSession } from "@/hooks/use-session";
import { Header } from "@/components/layout/header";
import { ObservabilitySidebar } from "@/components/chat/sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Skeleton } from "@/components/ui/skeleton";

export function ChatPage() {
  const { sessionId, isLoaded } = useSession();

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <main className="flex flex-1 overflow-hidden">
        {isLoaded && sessionId ? (
          <>
            <ObservabilitySidebar sessionId={sessionId} />
            <ChatPanel sessionId={sessionId} />
          </>
        ) : (
          <div className="flex flex-1 p-4 gap-4">
             <Skeleton className="hidden md:block md:w-1/3 lg:w-1/4 rounded-lg" />
             <Skeleton className="flex-1 rounded-lg" />
          </div>
        )}
      </main>
    </div>
  );
}
