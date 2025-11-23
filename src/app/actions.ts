
'use server';

import {
  generateResponse,
  GenerateResponseInput,
} from '@/ai/flows/generate-response';
import { revalidatePath } from 'next/cache';
import { initializeFirebase } from '@/firebase/server-init';
import { FieldValue } from 'firebase-admin/firestore';
import type { AgentMemoryFact } from '@/lib/types';

const { firestore: db } = initializeFirebase();

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

export async function createNewConversationAction(
  userId: string,
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  if (!userId || !sessionId) {
    return { success: false, error: 'User ID and Session ID are required.' };
  }

  try {
    const sessionRef = db.doc(`users/${userId}/sessions/${sessionId}`);

    // Delete subcollections first
    await deleteCollection(`users/${userId}/sessions/${sessionId}/messages`);
    await deleteCollection(`users/${userId}/sessions/${sessionId}/steps`);
    await deleteCollection(`users/${userId}/sessions/${sessionId}/facts`);

    // Delete the session document itself
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

export async function sendMessageAction(
  sessionId: string,
  userMessage: string,
  userId: string
): Promise<{ id: string; role: 'assistant'; content: string }> {
  if (!sessionId || !userMessage || !userId) {
    throw new Error('Session ID, user message, and user ID are required.');
  }

  try {
    // 1. Save user message to Firestore
    await db
      .collection(`users/${userId}/sessions/${sessionId}/messages`)
      .add({
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
      .filter((text) => text); // Filter out any empty/undefined text

    // 3. Call the Genkit flow with message and memory
    const flowInput: GenerateResponseInput = {
      userMessage,
      memory,
    };

    const flowOutput = await generateResponse(flowInput);
    const responseContent =
      flowOutput.response || "Sorry, I couldn't come up with a response.";

    // 4. Save assistant message to Firestore
    const docRef = await db
      .collection(`users/${userId}/sessions/${sessionId}/messages`)
      .add({
        role: 'assistant',
        content: responseContent,
        timestamp: FieldValue.serverTimestamp(),
      });

    // 5. Create a log entry for the turn
    await db.collection(`users/${userId}/sessions/${sessionId}/steps`).add({
      timestamp: FieldValue.serverTimestamp(),
      userMessage: userMessage,
      finalResponse: responseContent,
      reasoning: flowOutput.reasoning || 'No reasoning provided.',
      toolCalls: [],
      toolResults: [],
    });

    // 6. Save new facts to memory, if any
    if (flowOutput.newFacts && flowOutput.newFacts.length > 0) {
      const batch = db.batch();
      const factsCollection = db.collection(
        `users/${userId}/sessions/${sessionId}/facts`
      );
      flowOutput.newFacts.forEach((factText) => {
        const newFactRef = factsCollection.doc();
        batch.set(newFactRef, {
          text: factText,
          createdAt: FieldValue.serverTimestamp(),
          source: 'agent',
        });
      });
      await batch.commit();
    }

    revalidatePath('/');

    return { id: docRef.id, role: 'assistant', content: responseContent };
  } catch (error) {
    console.error('Error in sendMessageAction:', error);
    const errorMessage =
      'Sorry, something went wrong while processing your request.';
    try {
      await db
        .collection(`users/${userId}/sessions/${sessionId}/messages`)
        .add({
          role: 'assistant',
          content: errorMessage,
          timestamp: FieldValue.serverTimestamp(),
        });
      await db.collection(`users/${userId}/sessions/${sessionId}/steps`).add({
        timestamp: FieldValue.serverTimestamp(),
        userMessage: userMessage,
        finalResponse: errorMessage,
        reasoning: `Error occurred: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    } catch (dbError) {
      console.error('Error saving error message to Firestore:', dbError);
    }
    revalidatePath('/');
    return { id: 'error', role: 'assistant', content: errorMessage };
  }
}
