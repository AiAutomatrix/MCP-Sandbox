
"use client";

import { useSession } from "@/hooks/use-session";
import { Header } from "@/components/layout/header";
import { ObservabilitySidebar } from "@/components/chat/sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth, useUser, useFirestore } from "@/firebase";
import { useEffect } from "react";
import { signInAnonymously } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export function ChatPage() {
  const { sessionId, isLoaded: isSessionLoaded } = useSession();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();

  useEffect(() => {
    const manageUser = async () => {
      if (isUserLoading) return; // Wait until user state is resolved

      if (!user) {
        // If no user, sign them in anonymously
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Anonymous sign-in failed", error);
        }
      } else {
        // If there IS a user, check for their document in Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          // If the document doesn't exist, create it
          try {
            await setDoc(userDocRef, {
              uid: user.uid,
              createdAt: serverTimestamp(),
              isAnonymous: user.isAnonymous,
            });
          } catch (error) {
            console.error("Failed to create user document in Firestore", error);
          }
        }
      }
    };

    manageUser();
  }, [isUserLoading, user, auth, db]);
  
  const isLoaded = isSessionLoaded && !isUserLoading && user;

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <main className="flex flex-1 overflow-hidden">
        {isLoaded && sessionId && user ? (
          <>
            <ObservabilitySidebar sessionId={sessionId} userId={user.uid} />
            <ChatPanel sessionId={sessionId} userId={user.uid} />
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
