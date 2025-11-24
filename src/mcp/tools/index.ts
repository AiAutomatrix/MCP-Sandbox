import { mathEvaluator } from './math';
import { todoTool } from './todo';

// Tool registry for runtime execution
export const TOOL_REGISTRY: Record<string, any> = {
  mathEvaluator,
  todoTool,
};

export { mathEvaluator, todoTool };
