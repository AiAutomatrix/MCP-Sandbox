'use server';

import { ai } from '@/ai/genkit';
import { initializeFirebase } from '@/firebase/server-init';
import { z } from 'genkit';

const { firestore: db } = initializeFirebase();

export const conversationReviewTool = ai.defineTool(
  {
    name: 'conversationReviewTool',
    description:
      "Searches the conversation transcript. If a 'query' is provided, it finds specific messages. If no 'query' is provided, it returns the entire conversation transcript. Use this when the user asks what was said previously or asks you to remember something.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe(
          'The search term to find in the history. If omitted, the full transcript is returned.'
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

      const allMessages = snapshot.docs.map(
        (doc) => doc.data() as { role: string; content: string }
      );

      // If there's a query, filter messages. Otherwise, use all messages.
      const messagesToReturn = query
        ? allMessages.filter((msg) =>
            msg.content.toLowerCase().includes(query.toLowerCase())
          )
        : allMessages;

      if (messagesToReturn.length === 0) {
        return { result: `No messages found matching the query: "${query}"` };
      }

      // Return a formatted transcript of the relevant messages
      const transcript = messagesToReturn
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n');

      const resultHeader = query
        ? `Found matching messages in the transcript:\n`
        : `Full conversation transcript:\n`;

      return { result: `${resultHeader}${transcript}` };
    } catch (err: any) {
      return {
        error: `An error occurred while searching the conversation: ${
          err?.message ?? String(err)
        }`,
      };
    }
  }
);
