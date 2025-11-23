
"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollection, useMemoFirebase } from "@/firebase";
import { AgentLogStep, AgentMemoryFact, TodoItem } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirestore } from "@/firebase";

const ViewerSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
    {message}
  </div>
);

export function AgentLogViewer({ sessionId, userId }: { sessionId: string, userId: string }) {
  const db = useFirestore();
  const logsQuery = useMemoFirebase(() => {
    if (!userId || !sessionId) return null;
    return query(collection(db, "users", userId, "sessions", sessionId, "steps"), orderBy("timestamp", "desc"));
  }, [db, userId, sessionId]);

  const {
    data: logs,
    isLoading,
    error,
  } = useCollection<AgentLogStep>(logsQuery);

  if (isLoading) return <ViewerSkeleton />;
  if (error) return <EmptyState message="Error loading logs." />;
  if (!logs || logs.length === 0 || (logs.length === 1 && logs[0].id === 'initial')) return <EmptyState message="No logs yet." />;

  return (
    <Accordion type="single" collapsible className="w-full">
      {logs.filter(log => log.id !== 'initial').map((log) => (
        <AccordionItem value={log.id} key={log.id}>
          <AccordionTrigger className="text-sm text-left hover:no-underline">
            <div className="flex flex-col gap-1">
              <span className="font-semibold truncate max-w-xs">{log.userMessage}</span>
              <span className="text-xs text-muted-foreground">
                {log.timestamp
                  ? formatDistanceToNow(log.timestamp.toDate(), { addSuffix: true })
                  : "just now"}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-xs space-y-2 font-code">
            {log.reasoning && (
              <div>
                <h4 className="font-semibold text-muted-foreground mb-1">Reasoning:</h4>
                <p className="p-2 bg-muted rounded-md">{log.reasoning}</p>
              </div>
            )}
            {log.toolCalls && log.toolCalls.length > 0 && (
              <div>
                <h4 className="font-semibold text-muted-foreground mb-1">Tool Calls:</h4>
                <pre className="p-2 bg-muted rounded-md whitespace-pre-wrap break-all">
                  {JSON.stringify(log.toolCalls, null, 2)}
                </pre>
              </div>
            )}
             {log.finalResponse && (
              <div>
                <h4 className="font-semibold text-muted-foreground mb-1">Final Response:</h4>
                <p className="p-2 bg-muted rounded-md">{log.finalResponse}</p>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function AgentMemoryViewer({ sessionId, userId }: { sessionId: string, userId: string }) {
  const db = useFirestore();
  const factsQuery = useMemoFirebase(() => {
    if (!userId || !sessionId) return null;
    return query(collection(db, "users", userId, "sessions", sessionId, "facts"), orderBy("createdAt", "desc"));
  }, [db, userId, sessionId]);

  const {
    data: facts,
    isLoading,
    error,
  } = useCollection<AgentMemoryFact>(factsQuery);

  if (isLoading) return <ViewerSkeleton />;
  if (error) return <EmptyState message="Error loading memory." />;
  if (!facts || facts.length === 0 || (facts.length === 1 && facts[0].id === 'initial')) return <EmptyState message="No memory facts yet." />;

  return (
    <div className="space-y-2">
      {facts.filter(fact => fact.id !== 'initial').map((fact) => (
        <Card key={fact.id} className="bg-background">
          <CardContent className="p-3 text-sm">
            <p>{fact.text}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Source: {fact.source} &middot;{" "}
              {fact.createdAt
                ? formatDistanceToNow(fact.createdAt.toDate(), {
                    addSuffix: true,
                  })
                : "just now"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ToolMemoryViewer({ userId }: { userId: string }) {
  const db = useFirestore();
  const todosQuery = useMemoFirebase(() => {
    if (!userId) return null;
    return query(collection(db, "users", userId, "todos"), orderBy("createdAt", "desc"));
  }, [db, userId]);

  const {
    data: todos,
    isLoading,
    error,
  } = useCollection<TodoItem>(todosQuery);
  
  // In a real app with more tools, you'd have a selector here.
  // For now, we'll just show the todo tool's memory.

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Todo Tool Memory</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <ViewerSkeleton />}
        {error && <EmptyState message="Error loading tool memory." />}
        {!isLoading && !error && (!todos || todos.length === 0) && <EmptyState message="No to-do items yet." />}
        {todos && todos.length > 0 && (
          <ul className="space-y-2">
            {todos.map(todo => (
              <li key={todo.id} className="text-sm flex items-center gap-2">
                <span className={todo.completed ? "line-through text-muted-foreground" : ""}>
                  {todo.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
    
