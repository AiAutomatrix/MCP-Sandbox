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
import { db } from "@/lib/firebase";

export function useFirestoreSubscription<T>(
  collectionPath: string[],
  orderField: string = "timestamp",
  orderDirection: "asc" | "desc" = "asc",
  docLimit: number = 100
) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!collectionPath.every(p => p)) {
        setIsLoading(false);
        return;
    }
    
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
  }, [collectionPath.join('/'), orderField, orderDirection, docLimit]);

  return { data, isLoading, error };
}
