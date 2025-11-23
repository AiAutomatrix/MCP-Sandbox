"use server";

import {
  generateResponseWithTools,
  GenerateResponseWithToolsInput,
} from "@/ai/flows/generate-response-with-tools";
import { app } from "@/lib/firebase";
import { AgentMemoryFact, ChatMessage } from "@/lib/types";
import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { revalidatePath } from "next/cache";

const db = getFirestore(app);

export async function sendMessageAction(
  sessionId: string,
  userMessage: string
): Promise<{ id: string; role: "assistant"; content: string }> {
  if (!sessionId || !userMessage) {
    throw new Error("Session ID and user message are required.");
  }

  try {
    // 1. Save user message to Firestore
    const userMessageData = {
      role: "user",
      content: userMessage,
      timestamp: serverTimestamp(),
    };
    await addDoc(
      collection(db, "sessions", sessionId, "messages"),
      userMessageData
    );

    // 2. Load memory for the session
    const memoryFacts: AgentMemoryFact[] = [];
    const memoryQuery = query(
      collection(db, "agent_memory", sessionId, "facts"),
      orderBy("createdAt", "desc")
    );
    const memorySnapshot = await getDocs(memoryQuery);
    memorySnapshot.forEach((doc) => {
      memoryFacts.push(doc.data() as AgentMemoryFact);
    });

    // 3. Define tool descriptors
    // In a real app, this could be fetched from a registry
    const toolDescriptors = [
      {
        name: "randomFactTool",
        description: "Returns a random fact from a list of predefined facts.",
        inputSchema: {},
        outputSchema: { type: "string" },
      },
      {
        name: "addTodo",
        description: "Adds a to-do item to the user's to-do list.",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
            text: { type: "string" },
          },
        },
        outputSchema: {
          type: "object",
          properties: { success: { type: "boolean" }, message: { type: "string" } },
        },
      },
    ];

    // 4. Call the Genkit flow
    const flowInput: GenerateResponseWithToolsInput = {
      sessionId,
      userMessage,
      memoryFacts: memoryFacts.map((fact) => fact.text),
      toolDescriptors,
    };

    // The generateResponseWithTools flow is assumed to handle the full agent loop:
    // - Sending prompt to LLM
    // - Executing tool calls if necessary
    // - Writing logs to /agent_logs
    // - Writing memory to /agent_memory
    // - Writing data to /tool_memory
    const { finalResponse, toolCalls } = await generateResponseWithTools(
      flowInput
    );
    
    let responseContent = finalResponse;
    if (!responseContent && toolCalls && toolCalls.length > 0) {
      // If the flow only returns tool calls, we can provide a generic response.
      // A more advanced implementation might handle this differently.
      responseContent = `I'm on it. I've initiated the following action(s): ${toolCalls.map(tc => tc.name).join(', ')}.`;
    } else if (!responseContent) {
      responseContent = "I don't have a specific response for that, but I've processed your request.";
    }

    // 5. Save assistant message to Firestore
    const assistantMessageData = {
      role: "assistant",
      content: responseContent,
      timestamp: serverTimestamp(),
    };
    const docRef = await addDoc(
      collection(db, "sessions", sessionId, "messages"),
      assistantMessageData
    );

    // Revalidate the path to show new messages
    revalidatePath("/");

    return { id: docRef.id, role: "assistant", content: responseContent };
  } catch (error) {
    console.error("Error in sendMessageAction:", error);
    const errorMessage = "Sorry, something went wrong while processing your request.";
    // Optionally save an error message to the chat
    await addDoc(collection(db, "sessions", sessionId, "messages"), {
      role: "assistant",
      content: errorMessage,
      timestamp: serverTimestamp(),
    });
    revalidatePath("/");
    return { id: "error", role: "assistant", content: errorMessage };
  }
}
