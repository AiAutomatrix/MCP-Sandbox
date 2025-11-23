"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFirestoreSubscription } from "@/hooks/use-firestore-subscription";
import { AgentLogStep, AgentMemoryFact, TodoItem } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

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

export function AgentLogViewer({ sessionId }: { sessionId: string }) {
  const {
    data: logs,
    isLoading,
    error,
  } = useFirestoreSubscription<AgentLogStep>(
    ["agent_logs", sessionId, "steps"],
    "timestamp",
    "desc",
    20
  );

  if (isLoading) return <ViewerSkeleton />;
  if (error) return <EmptyState message="Error loading logs." />;
  if (logs.length === 0) return <EmptyState message="No logs yet." />;

  return (
    <Accordion type="single" collapsible className="w-full">
      {logs.map((log) => (
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

export function AgentMemoryViewer({ sessionId }: { sessionId: string }) {
  const {
    data: facts,
    isLoading,
    error,
  } = useFirestoreSubscription<AgentMemoryFact>(
    ["agent_memory", sessionId, "facts"],
    "createdAt",
    "desc"
  );

  if (isLoading) return <ViewerSkeleton />;
  if (error) return <EmptyState message="Error loading memory." />;
  if (facts.length === 0) return <EmptyState message="No memory facts yet." />;

  return (
    <div className="space-y-2">
      {facts.map((fact) => (
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

export function ToolMemoryViewer() {
  const {
    data: todos,
    isLoading,
    error,
  } = useFirestoreSubscription<TodoItem>(
    ["tool_memory", "todoTool", "items"],
    "createdAt",
    "desc"
  );
  
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
        {!isLoading && !error && todos.length === 0 && <EmptyState message="No to-do items yet." />}
        {todos.length > 0 && (
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
