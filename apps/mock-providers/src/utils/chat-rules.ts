export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function?: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
  name?: string;
}

export interface ChatCompletionResult {
  content: string | null;
  tool_calls?: ToolCall[];
  finish_reason: 'stop' | 'tool_calls';
}

export function evaluateChatRules(
  messages: ChatMessage[] = [],
  tools?: ToolDefinition[],
  scriptedReply?: string | null,
): ChatCompletionResult {
  // 1. Scripted reply from admin queue if available
  if (scriptedReply) {
    return {
      content: scriptedReply,
      finish_reason: 'stop',
    };
  }

  // 2. Check if last message is a tool result
  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.role === 'tool') {
    const rawContent = lastMessage.content || '';
    const truncated = typeof rawContent === 'string' ? rawContent.slice(0, 100) : '';
    return {
      content: `Based on our records: ${truncated}`,
      finish_reason: 'stop',
    };
  }

  // Helper to check tool availability
  const hasTool = (toolName: string): boolean => {
    if (!tools || !Array.isArray(tools)) return false;
    return tools.some((t) => t.function?.name === toolName || t.name === toolName);
  };

  // 3. Find last user message
  const userMessages = messages.filter((m) => m.role === 'user');
  const lastUserMessage = userMessages[userMessages.length - 1];
  const userContent = (lastUserMessage?.content || '').toLowerCase();

  // Rule: message contains refund and tools include searchKnowledgeBase -> tool call searchKnowledgeBase
  if (userContent.includes('refund') && hasTool('searchKnowledgeBase')) {
    return {
      content: null,
      tool_calls: [
        {
          id: `call_${Date.now()}_search`,
          type: 'function',
          function: {
            name: 'searchKnowledgeBase',
            arguments: JSON.stringify({ query: 'refund' }),
          },
        },
      ],
      finish_reason: 'tool_calls',
    };
  }

  // Rule: message contains goodbye and tools include endCall -> tool call endCall
  if (userContent.includes('goodbye') && hasTool('endCall')) {
    return {
      content: null,
      tool_calls: [
        {
          id: `call_${Date.now()}_end`,
          type: 'function',
          function: {
            name: 'endCall',
            arguments: '{}',
          },
        },
      ],
      finish_reason: 'tool_calls',
    };
  }

  // Rule: default
  return {
    content: 'This is a mock reply.',
    finish_reason: 'stop',
  };
}
