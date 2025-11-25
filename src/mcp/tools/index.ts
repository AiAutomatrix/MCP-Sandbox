import { mathEvaluator } from './math';
import { todoTool } from './todo';
import { conversationReviewTool } from './conversation';

// Tool registry for runtime execution
export const TOOL_REGISTRY: Record<string, any> = {
  mathEvaluator,
  todoTool,
  conversationReviewTool,
};

export { mathEvaluator, todoTool, conversationReviewTool };
