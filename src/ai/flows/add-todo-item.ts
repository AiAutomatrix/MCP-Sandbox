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
import { initializeFirebase } from '@/firebase/server-init';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const { firestore: db } = initializeFirebase();

const AddTodoItemInputSchema = z.object({
  sessionId: z.string().describe("The session ID of the user. This is used to extract the user ID."),
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
    description: "Adds a to-do item to the user's to-do list.",
    inputSchema: z.object({
      userId: z.string().describe("The ID of the user for whom the to-do should be added."),
      text: z.string().describe('The text of the to-do item to add.'),
    }),
    outputSchema: z.object({
      success: z.boolean().describe('Whether the to-do item was successfully added.'),
      message: z.string().describe('A message indicating the result of the operation.'),
    }),
  },
  async ({ userId, text }) => {
    try {
      const todosCollection = collection(db, 'users', userId, 'todos');
      await addDoc(todosCollection, {
        text,
        completed: false,
        createdAt: serverTimestamp(),
      });
      return {
        success: true,
        message: `Successfully added to-do item: "${text}"`,
      };
    } catch (error) {
      console.error('Error adding todo to Firestore:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        success: false,
        message: `Failed to add todo item. Reason: ${errorMessage}`,
      };
    }
  }
);

const addTodoItemPrompt = ai.definePrompt({
  name: 'addTodoItemPrompt',
  input: {schema: AddTodoItemInputSchema},
  output: {schema: AddTodoItemOutputSchema},
  tools: [addTodo],
  prompt: `You are a helpful assistant that manages a user's to-do list. When the user asks to add an item to their to-do list, use the addTodo tool to add the item. You must extract the userId from the sessionId, as the tool requires a userId. A sessionId is structured as 'user-id:session-id'. Respond to the user confirming that you added the item to their list. Think step by step.

User Input: {{{item}}}
Session ID: {{{sessionId}}}`,
});

const addTodoItemFlow = ai.defineFlow(
  {
    name: 'addTodoItemFlow',
    inputSchema: AddTodoItemInputSchema,
    outputSchema: AddTodoItemOutputSchema,
  },
  async input => {
    const userId = input.sessionId.split(':')[0];
    
    const {output} = await addTodoItemPrompt({ ...input, sessionId: `user-id:${userId}:session-id` });
    if(output?.toolCalls) {
        for(const toolCall of output.toolCalls) {
            if(toolCall.name === 'addTodo') {
                toolCall.arguments.userId = userId;
            }
        }
    }
    return output!;
  }
);

export {addTodoItem, AddTodoItemInput, AddTodoItemOutput};
