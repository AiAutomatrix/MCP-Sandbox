'use client';

import Link from 'next/link';
import { Gem, LogOut, Plus, Loader2 } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from './theme-toggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/hooks/use-session';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { createNewConversationAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export function Header() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { sessionId, createNewSession } = useSession();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const handleNewConversation = async () => {
    if (!user || !sessionId) return;
    setIsDeleting(true);
    const result = await createNewConversationAction(user.uid, sessionId);
    if (result.success) {
      toast({
        title: 'Conversation Deleted',
        description: 'Your previous conversation has been removed.',
      });
      createNewSession();
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          result.error || 'Could not delete the previous conversation.',
      });
    }
    setIsDeleting(false);
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length > 1) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex">
          <Link className="mr-6 flex items-center space-x-2" href="/">
            <Gem className="h-6 w-6 text-primary" />
            <span className="font-bold sm:inline-block font-headline">
              Gemini Sandbox
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          {user && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New Conversation
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your current conversation
                    history. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleNewConversation}
                    disabled={isDeleting}
                  >
                    {isDeleting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isDeleting ? 'Deleting...' : 'Continue'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <ThemeToggle />
          {isUserLoading ? (
            <Skeleton className="h-8 w-8 rounded-full" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={user.photoURL || undefined}
                      alt={user.displayName || 'User'}
                    />
                    <AvatarFallback>
                      {getInitials(user.displayName || user.email)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.displayName || 'My Account'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
