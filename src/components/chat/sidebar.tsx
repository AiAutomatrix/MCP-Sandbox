
"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BrainCircuit,
  History,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { AgentLogViewer, AgentMemoryViewer } from "./sidebar-viewers";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface ObservabilitySidebarProps {
  sessionId: string;
  userId: string;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export function ObservabilitySidebar({
  sessionId,
  userId,
  isMobileOpen,
  onMobileClose,
}: ObservabilitySidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isMobile = useIsMobile();

  const content = (
    <Tabs defaultValue="logs" className="flex flex-col h-full w-full">
      <TabsList className="grid w-full grid-cols-2 gap-1 p-1">
        <TabsTrigger value="logs" className="h-8 text-xs">
          <History className="h-4 w-4 mr-1.5" />
          Logs
        </TabsTrigger>
        <TabsTrigger value="agent_memory" className="h-8 text-xs">
          <BrainCircuit className="h-4 w-4 mr-1.5" />
          Memory
        </TabsTrigger>
      </TabsList>
      <TabsContent value="logs" className="flex-1 overflow-y-auto p-2 m-0">
        <AgentLogViewer sessionId={sessionId} userId={userId} />
      </TabsContent>
      <TabsContent
        value="agent_memory"
        className="flex-1 overflow-y-auto p-2 m-0"
      >
        <AgentMemoryViewer sessionId={sessionId} userId={userId} />
      </TabsContent>
    </Tabs>
  );

  if (isMobile) {
    return (
      <Sheet open={isMobileOpen} onOpenChange={onMobileClose}>
        <SheetContent side="left" className="p-0 w-full max-w-sm">
          <div className="flex flex-col h-full p-2">{content}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className={cn(
        "relative hidden md:flex flex-col border-r bg-muted/20 transition-all duration-300 ease-in-out p-2",
        isCollapsed ? "w-12 p-0" : "w-1/3 lg:w-1/4"
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-5 top-1/2 -translate-y-1/2 z-10 rounded-full border bg-background hover:bg-muted"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>

      <div
        className={cn(
          "flex-1 overflow-auto transition-opacity duration-200",
          isCollapsed ? "opacity-0" : "opacity-100"
        )}
      >
        {content}
      </div>
    </div>
  );
}
