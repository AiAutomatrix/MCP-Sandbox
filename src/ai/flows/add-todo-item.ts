'use server';

/**
 * @fileOverview Implements the AddTodoItem flow, allowing users to add items to their to-do list via the agent's reasoning and the to-do tool.
 *
 * - addTodoItem - A function that handles the addition of a to-do item.
 * - AddTodoItemInput - The input type for the addTodoItem function.
 * - AddTodoItemOutput - The return type for the addTodoItem function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AddTodoItemInputSchema = z.object({
  sessionId: z.string().describe('The session ID of the user.'),
  item: z.string().describe('The to-do item to add.'),
});
export type AddTodoItemInput = z.infer<typeof AddTodoItemInputSchema>;

const AddTodoItemOutputSchema = z.object({
  success: z.boolean().describe('Whether the to-do item was successfully added.'),
  message: z.string().describe('A message indicating the result of the operation.'),
});
export type AddTodoItemOutput = z.infer<typeof AddTodoItemOutputSchema>;

async function addTodoItem(input: AddTodoItemInput): Promise<AddTodoItemOutput> {
  return addTodoItemFlow(input);
}

const addTodo = ai.defineTool(
  {
    name: 'addTodo',
    description: 'Adds a to-do item to the user\'s to-do list.',
    inputSchema: z.object({
      sessionId: z.string().describe('The session ID of the user.'),
      text: z.string().describe('The text of the to-do item to add.'),
    }),
    outputSchema: z.object({
      success: z.boolean().describe('Whether the to-do item was successfully added.'),
      message: z.string().describe('A message indicating the result of the operation.'),
    }),
  },
  async input => {
    // Simulate adding the todo item to a database or external service here
    // In a real application, you would interact with Firestore or another data store

    console.log(`Adding todo item: ${input.text} for session: ${input.sessionId}`);

    // For now, just return a success message
    return {
      success: true,
      message: `Successfully added todo item: ${input.text}`, // backticks
    };
  }
);

const addTodoItemPrompt = ai.definePrompt({
  name: 'addTodoItemPrompt',
  input: {schema: AddTodoItemInputSchema},
  output: {schema: AddTodoItemOutputSchema},
  tools: [addTodo],
  prompt: `You are a helpful assistant that manages a user's to-do list. When the user asks to add an item to their to-do list, use the addTodo tool to add the item, using the provided sessionId.  A sessionId of 'test' indicates that the user is running in a test environment and does not have a real session. Respond to the user confirming that you added the item to their list. Think step by step.

User Input: {{{item}}}
Session ID: {{{sessionId}}}`, // backticks
});

const addTodoItemFlow = ai.defineFlow(
  {
    name: 'addTodoItemFlow',
    inputSchema: AddTodoItemInputSchema,
    outputSchema: AddTodoItemOutputSchema,
  },
  async input => {
    const {output} = await addTodoItemPrompt(input);
    return output!;
  }
);

export {addTodoItem, AddTodoItemInput, AddTodoItemOutput};
