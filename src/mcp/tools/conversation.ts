'use server';

import { ai } from '@/ai/genkit';
import { initializeFirebase } from '@/firebase/server-init';
import { z } from 'genkit';

const { firestore: db } = initializeFirebase();

export const conversationReviewTool = ai.defineTool(
  {
    name: 'conversationReviewTool',
    description:
      'Searches the full transcript of the current conversation to find specific information or review past messages. Use this when the user asks what was said previously or asks you to remember something.',
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'The search term or question to find in the conversation history.'
        ),
      userId: z
        .string()
        .describe('The ID of the user who owns the conversation.'),
      sessionId: z
        .string()
        .describe('The ID of the current conversation session.'),
    }),
    outputSchema: z.any(),
  },
  async ({ userId, sessionId, query }) => {
    if (!userId || !sessionId) {
      return {
        error: 'User ID and Session ID are required to review the conversation.',
      };
    }

    try {
      const messagesRef = db.collection(
        `users/${userId}/sessions/${sessionId}/messages`
      );
      const snapshot = await messagesRef.orderBy('timestamp', 'asc').get();

      if (snapshot.empty) {
        return { result: 'No conversation history found.' };
      }

      const allMessages = snapshot.docs.map((doc) => doc.data() as { role: string; content: string });

      const matchingMessages = allMessages.filter((msg) =>
        msg.content.toLowerCase().includes(query.toLowerCase())
      );
      
      if (matchingMessages.length === 0) {
        return { result: `No messages found matching the query: "${query}"` };
      }

      // Return a formatted transcript of matching messages
      const transcript = matchingMessages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
        
      return { result: `Found matching messages in the transcript:\n${transcript}` };

    } catch (err: any) {
      return {
        error: `An error occurred while searching the conversation: ${
          err?.message ?? String(err)
        }`,
      };
    }
  }
);
