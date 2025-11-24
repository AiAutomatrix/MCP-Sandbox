import { ai } from '@/ai/genkit';
import { initializeFirebase } from '@/firebase/server-init';
import { z } from 'genkit';

function getDb() {
  return initializeFirebase().firestore;
}

export const todoTool = ai.defineTool(
  {
    name: 'todoTool',
    description:
      'A Firestore-backed to-do list tool. It can add items, list existing items, and mark one or more items as complete. All to-do items are associated with the current user session.',
    inputSchema: z.object({
      action: z
        .enum(['add', 'list', 'complete'])
        .describe('The action to perform on the to-do list.'),
      text: z
        .string()
        .optional()
        .describe('The text content of the to-do item for the `add` action.'),
      ids: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe(
          'The document ID or an array of document IDs of the item(s) to `complete`.'
        ),
      sessionId: z
        .string()
        .optional()
        .describe(
          'The user session ID to scope the to-do items. This is required for security and data separation.'
        ),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    const db = getDb();
    const collectionBase = 'tool_memory/todoTool/items';

    try {
      if (input.action === 'add') {
        if (!input.text)
          return { error: '`text` is required for the `add` action.' };
        const docRef = await db.collection(collectionBase).add({
          text: input.text,
          completed: false,
          sessionId: input.sessionId || null,
          createdAt: new Date(),
        });
        return {
          success: true,
          message: `Successfully added to-do item: "${input.text}"`,
          id: docRef.id,
        };
      }

      if (input.action === 'list') {
        let q = db
          .collection(collectionBase)
          .where('completed', '==', false)
          .orderBy('createdAt', 'desc')
          .limit(200);
        if (input.sessionId) {
          q = q.where('sessionId', '==', input.sessionId);
        }
        const snap = await q.get();
        const items = snap.docs.map((d) => ({
          id: d.id,
          text: d.data().text,
          createdAt: d.data().createdAt.toDate().toISOString(),
        }));
        return { items };
      }

      if (input.action === 'complete') {
        if (!input.ids)
          return { error: '`ids` field is required for the `complete` action.' };

        const idsToComplete = Array.isArray(input.ids) ? input.ids : [input.ids];
        if (idsToComplete.length === 0) {
          return { error: 'No IDs provided to complete.' };
        }

        const batch = db.batch();
        idsToComplete.forEach((id) => {
          const ref = db.collection(collectionBase).doc(id);
          batch.update(ref, { completed: true });
        });

        await batch.commit();
        return {
          success: true,
          message: `Successfully completed ${idsToComplete.length} item(s).`,
          completed_ids: idsToComplete,
        };
      }

      return { error: `Unknown action: ${input.action}` };
    } catch (err: any) {
      return {
        error: `An error occurred while executing the to-do tool: ${err?.message ?? String(err)}`,
      };
    }
  }
);
