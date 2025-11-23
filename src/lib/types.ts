
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
  toolCalls?: any[]; // Allow flexible structure for logging
  toolResults?: any[]; // Allow flexible structure for logging
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

    
