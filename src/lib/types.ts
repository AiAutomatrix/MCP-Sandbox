import type { Timestamp } from "firebase/firestore";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Timestamp;
}

export interface AgentLogStep {
  id: string;
  timestamp: Timestamp;
  userMessage: string;
  modelResponse?: string;
  reasoning?: string;
  toolCalls?: { name: string; arguments: any }[];
  toolResults?: any[];
  finalResponse?: string;
}

export interface AgentMemoryFact {
  id: string;
  text: string;
  createdAt: Timestamp;
  source: "tool" | "user" | "agent";
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Timestamp;
}
