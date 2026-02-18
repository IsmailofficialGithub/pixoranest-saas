import { RetellAIClient } from './retell-ai';

/**
 * Create a Retell AI agent for a client.
 * This is meant to be called from an Edge Function that has access to API keys.
 */
export async function setupRetellAgent(options: {
  apiKey: string;
  agentName: string;
  script: string;
  voiceId: string;
  language: string;
}) {
  const retellClient = new RetellAIClient({ apiKey: options.apiKey });

  const agent = await retellClient.createAgent({
    agent_name: options.agentName,
    voice_id: options.voiceId,
    language: options.language,
    response_engine: {
      type: 'retell-llm',
      llm_id: 'default',
    },
    general_prompt: `You are an AI sales agent. Follow this script:\n\n${options.script}\n\nBe natural, friendly, and professional. Listen to the customer and adapt your responses.`,
    general_tools: [
      {
        type: 'end_call',
        name: 'end_call',
        description: 'End the call when appropriate',
      },
    ],
  });

  return agent;
}
