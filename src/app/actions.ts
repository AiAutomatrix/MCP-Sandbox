
"use server";

import {
  generateResponseWithTools,
  GenerateResponseWithToolsInput,
} from "@/ai/flows/generate-response-with-tools";
import { AgentMemoryFact, ChatMessage } from "@/lib/types";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { revalidatePath } from "next/cache";
import { initializeFirebase } from "@/firebase/server-init";

const { firestore: db } = initializeFirebase();

export async function sendMessageAction(
  sessionId: string,
  userMessage: string,
  userId: string
): Promise<{ id: string; role: "assistant"; content: string }> {
  if (!sessionId || !userMessage || !userId) {
    throw new Error("Session ID, user message, and user ID are required.");
  }

  try {
    // 1. Save user message to Firestore
    const userMessageData = {
      role: "user",
      content: userMessage,
      timestamp: serverTimestamp(),
    };
    await addDoc(
      collection(db, "users", userId, "sessions", sessionId, "messages"),
      userMessageData
    );

    // 2. Load memory for the session
    const memoryFacts: AgentMemoryFact[] = [];
    const memoryQuery = query(
      collection(db, "users", userId, "agent_memory", sessionId, "facts"),
      orderBy("createdAt", "desc")
    );
    const memorySnapshot = await getDocs(memoryQuery);
    memorySnapshot.forEach((doc) => {
      memoryFacts.push(doc.data() as AgentMemoryFact);
    });

    // 3. Define tool descriptors
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

    const { finalResponse, toolCalls } = await generateResponseWithTools(
      flowInput
    );
    
    let responseContent = finalResponse;
    if (!responseContent && toolCalls && toolCalls.length > 0) {
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
      collection(db, "users", userId, "sessions", sessionId, "messages"),
      assistantMessageData
    );

    revalidatePath("/");

    return { id: docRef.id, role: "assistant", content: responseContent };
  } catch (error) {
    console.error("Error in sendMessageAction:", error);
    const errorMessage = "Sorry, something went wrong while processing your request.";
    await addDoc(collection(db, "users", userId, "sessions", sessionId, "messages"), {
      role: "assistant",
      content: errorMessage,
      timestamp: serverTimestamp(),
    });
    revalidatePath("/");
    return { id: "error", role: "assistant", content: errorMessage };
  }
}
