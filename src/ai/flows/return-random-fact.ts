'use server';

/**
 * @fileOverview This flow implements the Random Fact Tool, allowing users to request a random fact from a predefined list.
 *
 * - getRandomFact - A function that returns a random fact using the Random Fact Tool.
 * - GetRandomFactInput - The input type for the getRandomFact function (currently empty).
 * - GetRandomFactOutput - The return type for the getRandomFact function, containing the random fact.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GetRandomFactInputSchema = z.object({});
export type GetRandomFactInput = z.infer<typeof GetRandomFactInputSchema>;

const GetRandomFactOutputSchema = z.object({
  fact: z.string().describe('A random fact from the predefined list.'),
});
export type GetRandomFactOutput = z.infer<typeof GetRandomFactOutputSchema>;

export async function getRandomFact(input: GetRandomFactInput): Promise<GetRandomFactOutput> {
  return getRandomFactFlow(input);
}

const randomFactTool = ai.defineTool(
  {
    name: 'randomFactTool',
    description: 'Returns a random fact from a list of predefined facts.',
    inputSchema: z.object({}),
    outputSchema: z.string(),
  },
  async () => {
    const facts = [
      'The Eiffel Tower can be 15 cm taller during the summer, due to thermal expansion.',
      'A bolt of lightning contains enough energy to toast 100,000 slices of bread.',
      'The average person walks the equivalent of five times around the world in their lifetime.',
      'Bananas are berries, but strawberries are not.',
      'A group of flamingos is called a flamboyance.',
    ];
    const fact = facts[Math.floor(Math.random() * facts.length)];
    return fact;
  }
);

const prompt = ai.definePrompt({
  name: 'getRandomFactPrompt',
  input: {schema: GetRandomFactInputSchema},
  output: {schema: GetRandomFactOutputSchema},
  prompt: `Use the randomFactTool to get a random fact.`,
  tools: [randomFactTool],
});

const getRandomFactFlow = ai.defineFlow(
  {
    name: 'getRandomFactFlow',
    inputSchema: GetRandomFactInputSchema,
    outputSchema: GetRandomFactOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    // The tool returns a string, but the output schema expects an object { fact: "..." }
    // The model automatically maps the tool's string output to the 'fact' field.
    return output!;
  }
);
