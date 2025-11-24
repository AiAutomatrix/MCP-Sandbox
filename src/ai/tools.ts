import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeFirebase } from '@/firebase/server-init';

function getDb() {
  return initializeFirebase().firestore;
}

// -----------------------------
// Tool Definitions
// -----------------------------

export const mathEvaluator = ai.defineTool(
  {
    name: 'mathEvaluator',
    description:
      'Evaluates a simple mathematical expression. (demo only; eval used for speed)',
    inputSchema: z.object({
      expression: z
        .string()
        .describe('A simple JS math expression like "2+2*3"'),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    try {
      // WARNING: eval() is unsafe for arbitrary input. This is a dev-only tool.
      // Replace with a proper math parser (mathjs) in prod.
      return String(eval(input.expression));
    } catch (err: any) {
      return `Error evaluating expression: ${err?.message ?? String(err)}`;
    }
  }
);

export const todoTool = ai.defineTool(
  {
    name: 'todoTool',
    description:
      'Simple Firestore-backed todo tool. Actions: add, list, complete. Uses sessionId to namespace todos.',
    inputSchema: z.object({
      action: z
        .enum(['add', 'list', 'complete'])
        .describe('Action to perform on todos'),
      sessionId: z
        .string()
        .optional()
        .describe('Optional sessionId to scope todos'),
      text: z.string().optional().describe('Text for add action'),
      id: z.string().optional().describe('ID for complete action'),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    const db = getDb();
    const collectionBase = 'tool_memory/todoTool/items';
    try {
      if (input.action === 'add') {
        if (!input.text) return { error: 'Missing text for add action' };
        const docRef = await db.collection(collectionBase).add({
          text: input.text,
          completed: false,
          sessionId: input.sessionId || null,
          createdAt: new Date(),
        });
        return { ok: true, id: docRef.id, text: input.text };
      }

      if (input.action === 'list') {
        let q = db
          .collection(collectionBase)
          .orderBy('createdAt', 'desc')
          .limit(200);
        if (input.sessionId) q = q.where('sessionId', '==', input.sessionId);
        const snap = await q.get();
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        return { items };
      }

      if (input.action === 'complete') {
        if (!input.id) return { error: 'Missing id for complete action' };
        const ref = db.collection(collectionBase).doc(input.id);
        await ref.update({ completed: true });
        return { ok: true, id: input.id };
      }

      return { error: 'Unknown action' };
    } catch (err: any)
      {
      return { error: err?.message ?? String(err) };
    }
  }
);

// Tool registry for runtime execution
export const TOOL_REGISTRY: Record<string, any> = {
  mathEvaluator,
  todoTool,
};
