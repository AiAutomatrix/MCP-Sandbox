# **App Name**: Gemini Sandbox

## Core Features:

- Message Handling: Receive user messages with a session ID.
- Memory Loading: Load memory associated with a session from Firestore.
- Tool Interaction: Execute the MCP flow where the model can request tool calls and incorporate tool results.
- MCP Agent Call: Call Gemini with a system prompt, user message, memory facts, and tool descriptors to formulate a response. The agent will use tools, if it thinks the user query asks for it. The prompt should encourage step-by-step thinking.
- Log Writing: Write all interactions, reasoning steps, and tool results to Firestore for debugging and observability.
- Random Fact Tool: A tool that returns a random string from a predefined list of facts. The model is expected to call the tool when the user asks for a fact. When called the tool updates Firestore with the usage history and the new fact.  
- To-do Tool: A tool to add to-do list. The model uses its reasoning to call this tool whenever a user requests to add an item in the todo list.

## Style Guidelines:

- Primary color: Slate blue (#708090) for a professional, clean look.
- Background color: Light gray (#E5E7E9) to provide a subtle backdrop.
- Accent color: Teal (#008080) to highlight key actions and elements.
- Body and headline font: 'Inter', a grotesque-style sans-serif, for a modern and objective feel.
- Code font: 'Source Code Pro' for displaying code snippets.
- Simple, minimalist icons to represent tools and actions.
- Subtle transitions and loading animations to enhance user experience.