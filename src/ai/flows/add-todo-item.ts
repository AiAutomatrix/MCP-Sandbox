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

export async function addTodoItem(input: AddTodoItemInput): Promise<AddTodoItemOutput> {
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
      const todoData = {
        text,
        completed: false,
        createdAt: serverTimestamp(),
      };
      await addDoc(todosCollection, todoData);
      return {
        success: true,
        message: `Successfully added to-do item: "${text}"`,
      };
    } catch (e: any) {
        console.error("Error adding todo:", e);
        return {
            success: false,
            message: `Failed to add to-do item: ${e.message}`,
        };
    }
  }
);

const addTodoItemPrompt = ai.definePrompt({
  name: 'addTodoItemPrompt',
  input: {schema: z.object({ item: z.string() }) },
  output: {schema: AddTodoItemOutputSchema},
  tools: [addTodo],
  prompt: `You are a helpful assistant that manages a user's to-do list. When the user asks to add an item to their to-do list, use the addTodo tool to add the item. 

User Input: {{{item}}}`,
});

const addTodoItemFlow = ai.defineFlow(
  {
    name: 'addTodoItemFlow',
    inputSchema: AddTodoItemInputSchema,
    outputSchema: AddTodoItemOutputSchema,
  },
  async input => {
    const userId = input.sessionId.split(':')[0];
    const {output} = await addTodoItemPrompt(
      { item: input.item },
      // The tool call needs the userId. We'll add it to the arguments here.
      {
        tools: {
          addTodo: {
            arguments: {
              userId,
            }
          }
        }
      }
    );
    return output!;
  }
);
