'use server';
/**
 * @fileOverview A memory-aware AI agent that can reason.
 *
 * This flow powers the core agent logic. It takes a user's message and the
 * conversation history (as facts) and generates a response. It also provides
 * its reasoning for the response and extracts new facts to be saved to memory.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Input schema: What the flow receives.
export const GenerateResponseInputSchema = z.object({
  userMessage: z.string().describe('The message sent by the user.'),
  memory: z
    .array(z.string())
    .describe(
      'A list of facts the agent has remembered from the conversation so far.'
    ),
});
export type GenerateResponseInput = z.infer<typeof GenerateResponseInputSchema>;

// Output schema: What the flow returns.
export const GenerateResponseOutputSchema = z.object({
  finalResponse: z.string().describe("The agent's final response to the user."),
  reasoning: z
    .string()
    .describe(
      'A step-by-step explanation of how the agent arrived at its response, including how it used its memory.'
    ),
  newFacts: z
    .array(z.string())
    .describe(
      'A list of new, atomic facts extracted from the current conversation turn to be added to memory. Can be empty.'
    ),
});
export type GenerateResponseOutput = z.infer<
  typeof GenerateResponseOutputSchema
>;

const generateResponsePrompt = ai.definePrompt({
  name: 'generateResponsePrompt',
  input: { schema: GenerateResponseInputSchema },
  output: { schema: GenerateResponseOutputSchema },
  prompt: `You are a helpful assistant with a persistent memory. Your goal is to be a good conversationalist.

You are given:
1.  A list of facts from your long-term memory.
2.  The user's latest message.

Your tasks are:
1.  **Provide a Response:** Formulate a direct, conversational response to the user's message. If the memory facts are relevant, incorporate them naturally into your reply.
2.  **Explain Your Reasoning:** Briefly explain how you arrived at your response. Mention if you used any facts from your memory.
3.  **Extract New Facts:** Identify any new, core pieces of information from the user's message or the conversation. List them as simple, atomic statements to be saved to your memory for future reference. If there are no new facts, return an empty array.

Here is the data for this turn:

## Memory Facts:
{{#if memory}}
{{#each memory}}
- {{{this}}}
{{/each}}
{{else}}
- Your memory is currently empty.
{{/if}}

## User Message:
"{{{userMessage}}}"
`,
});

// The flow function that orchestrates the call to the AI.
const generateResponseFlow = ai.defineFlow(
  {
    name: 'generateResponseFlow',
    inputSchema: GenerateResponseInputSchema,
    outputSchema: GenerateResponseOutputSchema,
  },
  async (input) => {
    const { output } = await generateResponsePrompt(input);

    // If the model somehow returns a null/undefined output, throw an error.
    if (!output) {
      throw new Error('The AI model did not produce any output.');
    }

    // Ensure we return an object that strictly matches the output schema.
    return {
      finalResponse: output.finalResponse || "I'm not sure how to respond to that.",
      reasoning: output.reasoning || 'No reasoning was provided.',
      newFacts: output.newFacts || [],
    };
  }
);

/**
 * A simple wrapper function to call the flow. This is the entry point
 * that will be used by our server actions.
 */
export async function generateResponse(
  input: GenerateResponseInput
): Promise<GenerateResponseOutput> {
  return generateResponseFlow(input);
}
