import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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
