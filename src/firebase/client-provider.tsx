'use client';

import { FirebaseProvider } from './provider';
import { app, auth, db } from '@/lib/firebase';

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FirebaseProvider value={{ app, auth, db }}>{children}</FirebaseProvider>;
}
