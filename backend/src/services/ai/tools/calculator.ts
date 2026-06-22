import type { Tool } from './types';

// Only allow digits, whitespace, decimal points, and basic arithmetic operators.
const SAFE_EXPRESSION = /^[0-9+\-*/().%\s]+$/;

export const calculatorTool: Tool = {
  name: 'calculator',
  description:
    'Evaluate a basic arithmetic expression (e.g. "1234 * 0.08"). Use for any math; do not compute it yourself.',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'Arithmetic expression to evaluate' },
    },
    required: ['expression'],
  },
  async execute(args) {
    const expression = String(args.expression ?? '').trim();
    if (!expression || !SAFE_EXPRESSION.test(expression)) {
      return { summary: `Invalid expression: "${expression}"` };
    }
    try {
      // Safe: input is restricted to math characters by SAFE_EXPRESSION above.
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${expression});`)() as number;
      if (typeof result !== 'number' || !Number.isFinite(result)) {
        return { summary: `Invalid expression: "${expression}"` };
      }
      return { summary: `${expression} = ${result}` };
    } catch {
      return { summary: `Invalid expression: "${expression}"` };
    }
  },
};
