'use server';

import {
  generateResponse,
  GenerateResponseInput,
  GenerateResponseOutput,
} from '@/ai/flows/generate-response';
import { TOOL_REGISTRY } from '@/ai/tools';
import { revalidatePath } from 'next/cache';
import { initializeFirebase } from '@/firebase/server-init';
import { FieldValue } from 'firebase-admin/firestore';
import type { AgentMemoryFact } from '@/lib/types';

const { firestore: db } = initializeFirebase();
const MAX_TOOL_LOOPS = 5;

// Helper to delete subcollections
async function deleteCollection(
  collectionPath: string,
  batchSize: number = 50
) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(
  query: FirebaseFirestore.Query,
  resolve: (value?: unknown) => void
) {
  const snapshot = await query.get();

  if (snapshot.size === 0) {
    return resolve();
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

// Action to create a new conversation (deletes the old one)
export async function createNewConversationAction(
  userId: string,
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  if (!userId || !sessionId) {
    return { success: false, error: 'User ID and Session ID are required.' };
  }

  try {
    const sessionRef = db.doc(`users/${userId}/sessions/${sessionId}`);
    await deleteCollection(`users/${userId}/sessions/${sessionId}/messages`);
    await deleteCollection(`users/${userId}/sessions/${sessionId}/steps`);
    await deleteCollection(`users/${userId}/sessions/${sessionId}/facts`);
    await sessionRef.delete();

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return {
      success: false,
      error: 'Could not delete the conversation. Please try again.',
    };
  }
}

// Helper to save a log step
async function logStep(
  userId: string,
  sessionId: string,
  stepData: object
) {
  await db
    .collection(`users/${userId}/sessions/${sessionId}/steps`)
    .add({ ...stepData, timestamp: FieldValue.serverTimestamp() });
}

// Helper to save new memory facts
async function saveFacts(
  userId: string,
  sessionId: string,
  newFacts: string[]
) {
  if (newFacts && newFacts.length > 0) {
    const batch = db.batch();
    const factsCollection = db.collection(
      `users/${userId}/sessions/${sessionId}/facts`
    );
    newFacts.forEach((factText) => {
      const newFactRef = factsCollection.doc();
      batch.set(newFactRef, {
        text: factText,
        createdAt: FieldValue.serverTimestamp(),
        source: 'agent',
      });
    });
    await batch.commit();
  }
}

// Main action to handle sending a message
export async function sendMessageAction(
  sessionId: string,
  userMessage: string,
  userId: string
): Promise<{ id: string; role: 'assistant'; content: string }> {
  if (!sessionId || !userMessage || !userId) {
    throw new Error('Session ID, user message, and user ID are required.');
  }

  try {
    // 1. Save user message
    await db.collection(`users/${userId}/sessions/${sessionId}/messages`).add({
      role: 'user',
      content: userMessage,
      timestamp: FieldValue.serverTimestamp(),
    });

    // 2. Fetch existing memory
    const factsSnapshot = await db
      .collection(`users/${userId}/sessions/${sessionId}/facts`)
      .orderBy('createdAt', 'asc')
      .get();
    const memory = factsSnapshot.docs
      .map((doc) => (doc.data() as AgentMemoryFact).text)
      .filter((text) => text);

    // 3. Start the agent loop
    let promptInput: GenerateResponseInput = { userMessage, memory };
    let finalResponse = '';

    for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
      const flowOutput: GenerateResponseOutput = await generateResponse(
        promptInput
      );

      // Log the AI's reasoning and potential tool request
      await logStep(userId, sessionId, {
        userMessage: i === 0 ? userMessage : undefined, // Only log user message on first step
        reasoning: flowOutput.reasoning,
        toolCalls: flowOutput.toolRequest
          ? [JSON.stringify(flowOutput.toolRequest)]
          : [],
      });

      // Save any new facts from this step
      if (flowOutput.newFacts) {
        await saveFacts(userId, sessionId, flowOutput.newFacts);
      }
      
      // 4. Check for a tool request
      if (flowOutput.toolRequest) {
        const tool = TOOL_REGISTRY[flowOutput.toolRequest.name];
        if (!tool) {
          throw new Error(`Unknown tool: ${flowOutput.toolRequest.name}`);
        }
        
        // Execute the tool
        const toolResult = await tool(flowOutput.toolRequest.input ?? {});

        // Log the tool's result
        await logStep(userId, sessionId, {
            toolResults: [JSON.stringify(toolResult)]
        });

        // Prepare the input for the next loop iteration
        promptInput = { ...promptInput, userMessage: '', toolResponse: toolResult };
        continue; // Go to the next iteration
      }

      // 5. If no tool request, we have our final answer
      if (flowOutput.response) {
        finalResponse = flowOutput.response;
        // Log the final response
         await logStep(userId, sessionId, {
            finalResponse: finalResponse
        });
        break; // Exit the loop
      }
    }

    if (!finalResponse) {
      finalResponse = "Sorry, I couldn't come up with a response.";
    }

    // 6. Save the final assistant message
    const docRef = await db
      .collection(`users/${userId}/sessions/${sessionId}/messages`)
      .add({
        role: 'assistant',
        content: finalResponse,
        timestamp: FieldValue.serverTimestamp(),
      });

    revalidatePath('/');
    return { id: docRef.id, role: 'assistant', content: finalResponse };
  } catch (error) {
    console.error('Error in sendMessageAction:', error);
    const errorMessage = 'Sorry, something went wrong while processing your request.';
    // Attempt to save an error message to the chat for user feedback
    const docRef = await db
      .collection(`users/${userId}/sessions/${sessionId}/messages`)
      .add({
        role: 'assistant',
        content: errorMessage,
        timestamp: FieldValue.serverTimestamp(),
      });
    await logStep(userId, sessionId, {
      userMessage,
      finalResponse: errorMessage,
      reasoning: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
    revalidatePath('/');
    return { id: docRef.id, role: 'assistant', content: errorMessage };
  }
}
