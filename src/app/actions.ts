
"use server";

import {
  generateResponse,
  GenerateResponseInput,
} from "@/ai/flows/generate-response";
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
      timestamp: new Date(),
    };
    await db.collection(`users/${userId}/sessions/${sessionId}/messages`).add(userMessageData);

    // 2. Call the simplified Genkit flow
    const flowInput: GenerateResponseInput = {
      userMessage,
    };

    const flowOutput = await generateResponse(flowInput);
    
    const responseContent = flowOutput.response || "Sorry, I couldn't come up with a response.";

    // 3. Save assistant message to Firestore
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
