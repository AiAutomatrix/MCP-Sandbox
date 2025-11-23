'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Chrome } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const SESSION_KEY_PREFIX = "gemini_sandbox_session_id_";

// This function checks for and creates a user document and their initial session in Firestore.
// It's designed to be called after any successful authentication event.
const ensureUserDocument = async (db: any, user: User) => {
  const userDocRef = doc(db, 'users', user.uid);

  try {
    // We use a transaction to ensure both the user doc and their initial session are created together.
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userDocRef);

      if (!userDoc.exists()) {
        // 1. Create the User Document
        transaction.set(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
          isAnonymous: user.isAnonymous,
        });

        // 2. Create the initial Session Document
        // We'll generate a new session ID here and save it to localStorage for the app to use.
        const newSessionId = uuidv4();
        const sessionDocRef = doc(db, 'users', user.uid, 'sessions', newSessionId);
        transaction.set(sessionDocRef, {
          createdAt: serverTimestamp(),
          userId: user.uid,
        });
        
        // 3. Store the new session ID in localStorage
        // This ensures the main app picks up the session we just created.
        try {
           const sessionKey = `${SESSION_KEY_PREFIX}${user.uid}`;
           localStorage.setItem(sessionKey, newSessionId);
        } catch (e) {
          // If localStorage fails, the app will create a new session ID on the next page load,
          // which is a safe fallback.
          console.warn("Could not set session ID in localStorage from login page:", e);
        }
      }
    });
  } catch (error) {
    console.error("Error ensuring user and session documents in transaction:", error);
    // This is a critical failure, we should inform the user.
    // In a real app, you might want to sign the user out here.
    throw new Error("Failed to initialize your user profile. Please try again.");
  }
};

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const handleAuthSuccess = async (user: User) => {
    try {
      await ensureUserDocument(db, user);
      router.push('/');
      toast({
        title: 'Success!',
        description: 'You are now logged in.',
      });
    } catch (error: any) {
       handleAuthError(error, 'User Profile Creation');
    }
  };

  const handleAuthError = (error: any, action: string) => {
    toast({
      variant: 'destructive',
      title: `Authentication failed`,
      description: error.message,
    });
    console.error(`Error during ${action}:`, error);
    setIsLoading(false);
    setIsGoogleLoading(false);
  };

  const handleEmailPasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await handleAuthSuccess(userCredential.user);
    } catch (error: any) {
      handleAuthError(error, 'login');
    }
  };

  const handleEmailPasswordSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await handleAuthSuccess(userCredential.user);
    } catch (error: any) {
      handleAuthError(error, 'signup');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      await handleAuthSuccess(userCredential.user);
    } catch (error: any) {
      handleAuthError(error, 'google');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <CardTitle>Welcome to Gemini Sandbox</CardTitle>
          <CardDescription>Sign in or create an account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleEmailPasswordSignIn} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleEmailPasswordSignUp} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Creating Account...' : 'Sign Up'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading ? (
              'Signing in...'
            ) : (
              <>
                <Chrome className="mr-2 h-5 w-5" />
                Sign in with Google
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
