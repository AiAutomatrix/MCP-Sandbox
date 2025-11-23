
"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  Query,
  DocumentData,
  limit,
} from "firebase/firestore";
import { useFirestore } from "@/firebase";

export function useFirestoreSubscription<T>(
  collectionPath: string[],
  orderField: string = "timestamp",
  orderDirection: "asc" | "desc" = "asc",
  docLimit: number = 100
) {
  const db = useFirestore();
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // If the path is empty or contains falsy values, it means we should not fetch yet.
    if (collectionPath.length === 0 || !collectionPath.every(p => p)) {
        setData([]);
        setIsLoading(false);
        return;
    }
    
    setIsLoading(true);
    let q: Query<DocumentData>;
    try {
        const collRef = collection(db, ...collectionPath);
        q = query(collRef, orderBy(orderField, orderDirection), limit(docLimit));
    } catch(e) {
        console.error("Error creating Firestore query:", e);
        setError(e as Error);
        setIsLoading(false);
        return;
    }
    

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const documents = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];
        setData(documents);
        setIsLoading(false);
      },
      (err) => {
        console.error("Firestore subscription error:", err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, collectionPath.join('/'), orderField, orderDirection, docLimit]);

  return { data, isLoading, error };
}
