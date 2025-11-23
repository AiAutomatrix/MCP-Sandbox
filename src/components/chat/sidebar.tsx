"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BrainCircuit,
  History,
  Wrench,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  AgentLogViewer,
  AgentMemoryViewer,
  ToolMemoryViewer,
} from "./sidebar-viewers";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

export function ObservabilitySidebar({ sessionId }: { sessionId: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={cn(
        "relative hidden md:flex flex-col border-r bg-muted/20 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-12" : "w-1/3 lg:w-1/4"
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-5 top-1/2 -translate-y-1/2 z-10 rounded-full border bg-background hover:bg-muted"
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      <div
        className={cn(
          "flex-1 overflow-auto transition-opacity duration-200",
          isCollapsed ? "opacity-0" : "opacity-100"
        )}
      >
        <Tabs defaultValue="logs" className="flex flex-col h-full">
          <TabsList className="grid w-full grid-cols-3 m-2">
            <TabsTrigger value="logs">
              <History className="h-4 w-4 mr-2" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="agent_memory">
              <BrainCircuit className="h-4 w-4 mr-2" />
              Memory
            </TabsTrigger>
            <TabsTrigger value="tool_memory">
              <Wrench className="h-4 w-4 mr-2" />
              Tools
            </TabsTrigger>
          </TabsList>
          <TabsContent value="logs" className="flex-1 overflow-y-auto p-2 m-0">
            <AgentLogViewer sessionId={sessionId} />
          </TabsContent>
          <TabsContent
            value="agent_memory"
            className="flex-1 overflow-y-auto p-2 m-0"
          >
            <AgentMemoryViewer sessionId={sessionId} />
          </TabsContent>
          <TabsContent
            value="tool_memory"
            className="flex-1 overflow-y-auto p-2 m-0"
          >
            <ToolMemoryViewer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
