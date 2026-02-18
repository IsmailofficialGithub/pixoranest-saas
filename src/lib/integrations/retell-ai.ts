export interface RetellConfig {
  apiKey: string;
  agentId?: string;
  fromNumber?: string;
}

export interface RetellCallOptions {
  toNumber: string;
  fromNumber: string;
  agentId: string;
  customData?: Record<string, any>;
  webhookUrl?: string;
}

export interface RetellCallResponse {
  call_id: string;
  status: string;
  agent_id: string;
  to_number: string;
  from_number: string;
}

export class RetellAIClient {
  private apiKey: string;
  private baseUrl: string = 'https://api.retellai.com';

  constructor(config: RetellConfig) {
    this.apiKey = config.apiKey;
  }

  async createPhoneCall(options: RetellCallOptions): Promise<RetellCallResponse> {
    const response = await fetch(`${this.baseUrl}/create-phone-call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from_number: options.fromNumber,
        to_number: options.toNumber,
        override_agent_id: options.agentId,
        retell_llm_dynamic_variables: options.customData || {},
        webhook_url: options.webhookUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Retell API error: ${error.message || response.statusText}`);
    }

    return await response.json();
  }

  async getCall(callId: string) {
    const response = await fetch(`${this.baseUrl}/get-call/${callId}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to get call: ${response.statusText}`);
    }

    return await response.json();
  }

  async listCalls(filters?: { limit?: number; start_time?: string; end_time?: string }) {
    const params = new URLSearchParams();
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.start_time) params.append('start_time', filters.start_time);
    if (filters?.end_time) params.append('end_time', filters.end_time);

    const response = await fetch(`${this.baseUrl}/list-calls?${params}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to list calls: ${response.statusText}`);
    }

    return await response.json();
  }

  async createAgent(agentConfig: {
    agent_name: string;
    voice_id: string;
    language: string;
    response_engine: object;
    general_prompt: string;
    general_tools?: any[];
  }) {
    const response = await fetch(`${this.baseUrl}/create-agent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentConfig),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create agent: ${error.message || response.statusText}`);
    }

    return await response.json();
  }

  async endCall(callId: string) {
    const response = await fetch(`${this.baseUrl}/end-call/${callId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to end call: ${response.statusText}`);
    }

    return await response.json();
  }
}

/**
 * Process Retell webhook payload into a normalized structure
 */
export function processRetellWebhook(payload: any) {
  return {
    call_id: payload.call_id,
    call_status: payload.call_status,
    call_type: payload.call_type,
    agent_id: payload.agent_id,
    from_number: payload.from_number,
    to_number: payload.to_number,
    duration_ms: payload.duration_ms,
    start_timestamp: payload.start_timestamp,
    end_timestamp: payload.end_timestamp,
    transcript: payload.transcript,
    transcript_object: payload.transcript_object,
    recording_url: payload.recording_url,
    public_log_url: payload.public_log_url,
    call_analysis: payload.call_analysis,
    retell_llm_dynamic_variables_used: payload.retell_llm_dynamic_variables_used,
  };
}
