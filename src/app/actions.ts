
'use server';

import {
  generateResponse,
  GenerateResponseInput,
  GenerateResponseOutput,
} from '@/ai/flows/generate-response';
import { revalidatePath } from 'next/cache';
import { initializeFirebase } from '@/firebase/server-init';
import { FieldValue } from 'firebase-admin/firestore';
import type { AgentMemoryFact } from '@/lib/types';
import { TOOL_REGISTRY } from '@/mcp/tools';

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

    revalidatePath('/'); // Revalidate to clear server-side caches for logs/memory
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
): Promise<void> {
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
    let flowOutput: GenerateResponseOutput | null = null;
    let combinedLogData: any = { userMessage };

    for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
      flowOutput = await generateResponse(promptInput);
      
      // Combine reasoning and tool calls into one log object for the step
      if (flowOutput.reasoning) combinedLogData.reasoning = flowOutput.reasoning;
      if (flowOutput.toolRequest) combinedLogData.toolCalls = [JSON.stringify(flowOutput.toolRequest)];
      
      if (flowOutput.newFacts) {
        await saveFacts(userId, sessionId, flowOutput.newFacts);
      }
      
      if (flowOutput.toolRequest) {
        const toolName = flowOutput.toolRequest.name;
        let tool = TOOL_REGISTRY[toolName];
        
        if (!tool) {
          const simpleName = toolName.split('.').pop();
          if (simpleName) {
              tool = TOOL_REGISTRY[simpleName];
          }
        }
        
        if (!tool) {
          throw new Error(`Unknown tool: ${toolName}`);
        }
        
        const toolResult = await tool(flowOutput.toolRequest.input ?? {});

        combinedLogData.toolResults = [typeof toolResult === 'object' ? JSON.stringify(toolResult, null, 2) : toolResult];
        await logStep(userId, sessionId, combinedLogData);
        combinedLogData = {}; // Clear for next potential loop
        
        const toolResponseForPrompt =
          typeof toolResult === 'object'
            ? JSON.stringify(toolResult, null, 2)
            : toolResult;
        
        promptInput = { ...promptInput, userMessage: '', toolResponse: toolResponseForPrompt };

        continue;
      }

      if (flowOutput.response) {
        finalResponse = flowOutput.response;
        combinedLogData.finalResponse = finalResponse;
        await logStep(userId, sessionId, combinedLogData);
        break; 
      }

       // If there's only reasoning without a tool call or final response, log it.
      if (flowOutput.reasoning && !finalResponse) {
         await logStep(userId, sessionId, combinedLogData);
         combinedLogData = {}; // Reset for next loop if any
      }
    }

    if (!finalResponse && flowOutput && flowOutput.response) {
      finalResponse = flowOutput.response;
    }

    if (!finalResponse) {
      finalResponse = "Sorry, I couldn't come up with a response.";
      await logStep(userId, sessionId, {
        userMessage: userMessage,
        reasoning: 'Agent failed to produce a final response after exhausting tool loops or initial generation.',
        finalResponse: finalResponse,
      });
    }

    await db
      .collection(`users/${userId}/sessions/${sessionId}/messages`)
      .add({
        role: 'assistant',
        content: finalResponse,
        timestamp: FieldValue.serverTimestamp(),
      });
    
    // Revalidate the path to update server-side rendered components like logs and memory
    revalidatePath('/');
    

  } catch (error) {
    console.error('Error in sendMessageAction:', error);
    const errorMessage = 'Sorry, something went wrong while processing your request.';
    await db
      .collection(`users/${userId}/sessions/${sessionId}/messages`)
      .add({
        role: 'assistant',
        content: errorMessage,
        timestamp: FieldValue.serverTimestamp(),
      });
    const logData: any = {
      finalResponse: errorMessage,
      reasoning: `Error: ${error instanceof Error ? error.message : String(error)}`,
      userMessage,
    };

    await logStep(userId, sessionId, logData);

    revalidatePath('/'); // Also revalidate on error
  }
}
