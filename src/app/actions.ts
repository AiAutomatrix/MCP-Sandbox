
"use server";

import {
  generateResponseWithTools,
  GenerateResponseWithToolsInput,
} from "@/ai/flows/generate-response-with-tools";
import { AgentMemoryFact } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { initializeFirebase } from "@/firebase/server-init";
import { addTodoItem } from "@/ai/flows/add-todo-item";
import { getRandomFact } from "@/ai/flows/return-random-fact";

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
      timestamp: new Date(),
    };
    await db.collection(`users/${userId}/sessions/${sessionId}/messages`).add(userMessageData);


    // 2. Load memory for the session
    const memoryFacts: AgentMemoryFact[] = [];
    const memoryQuery = db.collection(`users/${userId}/sessions/${sessionId}/facts`).orderBy("createdAt", "desc");
    
    const memorySnapshot = await memoryQuery.get();
    memorySnapshot.forEach((doc) => {
      if (doc.id !== 'initial') {
        memoryFacts.push(doc.data() as AgentMemoryFact);
      }
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
            userId: { type: "string" },
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
      sessionId: `${userId}:${sessionId}`,
      userMessage,
      memoryFacts: memoryFacts.map((fact) => fact.text),
      toolDescriptors,
    };

    const { finalResponse, toolCalls } = await generateResponseWithTools(
      flowInput
    );

    let responseContent = finalResponse;

    if (toolCalls && toolCalls.length > 0) {
      let toolResponseMessages = "";
      for (const toolCall of toolCalls) {
        if (toolCall.name === 'addTodo') {
          const result = await addTodoItem({ sessionId: `${userId}:${sessionId}`, item: toolCall.arguments.text });
          toolResponseMessages += result.message + "\n";
        } else if (toolCall.name === 'randomFactTool') {
            const result = await getRandomFact({});
            toolResponseMessages += result.fact + "\n";
        }
      }
      responseContent = toolResponseMessages.trim();
    }
    
    if (!responseContent) {
      responseContent = "I don't have a specific response for that, but I've processed your request.";
    }


    // 5. Save assistant message to Firestore
    const assistantMessageData = {
      role: "assistant",
      content: responseContent,
      timestamp: new Date(),
    };
    const docRef = await db.collection(`users/${userId}/sessions/${sessionId}/messages`).add(assistantMessageData);


    revalidatePath("/");

    return { id: docRef.id, role: "assistant", content: responseContent };
  } catch (error) {
    console.error("Error in sendMessageAction:", error);
    const errorMessage = "Sorry, something went wrong while processing your request.";
    try {
      await db.collection(`users/${userId}/sessions/${sessionId}/messages`).add({
        role: "assistant",
        content: errorMessage,
        timestamp: new Date(),
      });
    } catch (dbError) {
       console.error("Error saving error message to Firestore:", dbError);
    }
    revalidatePath("/");
    return { id: "error", role: "assistant", content: errorMessage };
  }
}
