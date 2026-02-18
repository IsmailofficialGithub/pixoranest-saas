/**
 * Unified Telephony Provider Integration Module
 * Supports Exotel, Twilio, and Telnyx providers
 */

export interface TelephonyConfig {
  provider: 'exotel' | 'twilio' | 'telnyx';
  accountSid: string;
  apiKey: string;
  apiSecret?: string;
  fromNumber: string;
}

export interface CallOptions {
  to: string;
  from?: string;
  url?: string;
  timeout?: number;
  record?: boolean;
  machineDetection?: boolean;
  statusCallback?: string;
}

export interface CallResult {
  callId: string;
  status: string;
  provider: string;
}

export interface CallStatus {
  callId: string;
  status: string;
  duration?: number;
  startTime?: string;
  endTime?: string;
  direction?: string;
  price?: number;
}

export interface SMSResult {
  messageId: string;
  status: string;
  provider: string;
}

// ─── Abstract Base ───────────────────────────────────────────────

export abstract class TelephonyClient {
  protected config: TelephonyConfig;

  constructor(config: TelephonyConfig) {
    this.config = config;
  }

  abstract makeCall(options: CallOptions): Promise<CallResult>;
  abstract getCallStatus(callId: string): Promise<CallStatus>;
  abstract getCallRecording(callId: string): Promise<string>;
  abstract endCall(callId: string): Promise<boolean>;
  abstract sendSMS(to: string, message: string): Promise<SMSResult>;

  protected getFromNumber(options: CallOptions): string {
    return options.from || this.config.fromNumber;
  }
}

// ─── Exotel ──────────────────────────────────────────────────────

export class ExotelClient extends TelephonyClient {
  private baseUrl = 'https://api.exotel.com/v1/Accounts';

  private get authHeader(): string {
    const credentials = `${this.config.apiKey}:${this.config.apiSecret || ''}`;
    return `Basic ${btoa(credentials)}`;
  }

  async makeCall(options: CallOptions): Promise<CallResult> {
    const url = `${this.baseUrl}/${this.config.accountSid}/Calls/connect.json`;

    const formData = new URLSearchParams();
    formData.append('From', options.to);
    formData.append('To', options.to);
    formData.append('CallerId', this.getFromNumber(options));
    formData.append('TimeLimit', (options.timeout || 3600).toString());
    formData.append('Record', options.record ? 'true' : 'false');

    if (options.url) {
      formData.append('Url', options.url);
    }
    if (options.statusCallback) {
      formData.append('StatusCallback', options.statusCallback);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Exotel API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      callId: data.Call.Sid,
      status: data.Call.Status,
      provider: 'exotel',
    };
  }

  async getCallStatus(callId: string): Promise<CallStatus> {
    const url = `${this.baseUrl}/${this.config.accountSid}/Calls/${callId}.json`;

    const response = await fetch(url, {
      headers: { Authorization: this.authHeader },
    });

    const data = await response.json();
    return {
      callId: data.Call?.Sid || callId,
      status: data.Call?.Status || 'unknown',
      duration: data.Call?.Duration ? parseInt(data.Call.Duration, 10) : undefined,
      startTime: data.Call?.StartTime,
      endTime: data.Call?.EndTime,
      direction: data.Call?.Direction,
      price: data.Call?.Price ? parseFloat(data.Call.Price) : undefined,
    };
  }

  async getCallRecording(callId: string): Promise<string> {
    const url = `${this.baseUrl}/${this.config.accountSid}/Calls/${callId}/Recordings.json`;

    const response = await fetch(url, {
      headers: { Authorization: this.authHeader },
    });

    const data = await response.json();
    return data.Recordings?.[0]?.RecordingUrl || '';
  }

  async endCall(callId: string): Promise<boolean> {
    const url = `${this.baseUrl}/${this.config.accountSid}/Calls/${callId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ Status: 'completed' }),
    });

    return response.ok;
  }

  async sendSMS(to: string, message: string): Promise<SMSResult> {
    const url = `${this.baseUrl}/${this.config.accountSid}/Sms/send.json`;

    const formData = new URLSearchParams();
    formData.append('From', this.config.fromNumber);
    formData.append('To', to);
    formData.append('Body', message);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const data = await response.json();
    return {
      messageId: data.SMSMessage?.Sid || '',
      status: data.SMSMessage?.Status || 'unknown',
      provider: 'exotel',
    };
  }
}

// ─── Twilio ──────────────────────────────────────────────────────

export class TwilioClient extends TelephonyClient {
  private baseUrl = 'https://api.twilio.com/2010-04-01/Accounts';

  private get authHeader(): string {
    const credentials = `${this.config.accountSid}:${this.config.apiKey}`;
    return `Basic ${btoa(credentials)}`;
  }

  async makeCall(options: CallOptions): Promise<CallResult> {
    const url = `${this.baseUrl}/${this.config.accountSid}/Calls.json`;

    const formData = new URLSearchParams();
    formData.append('To', options.to);
    formData.append('From', this.getFromNumber(options));
    formData.append('Timeout', (options.timeout || 60).toString());
    formData.append('Record', options.record ? 'true' : 'false');

    if (options.url) {
      formData.append('Url', options.url);
    }
    if (options.statusCallback) {
      formData.append('StatusCallback', options.statusCallback);
    }
    if (options.machineDetection) {
      formData.append('MachineDetection', 'Enable');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Twilio API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      callId: data.sid,
      status: data.status,
      provider: 'twilio',
    };
  }

  async getCallStatus(callId: string): Promise<CallStatus> {
    const url = `${this.baseUrl}/${this.config.accountSid}/Calls/${callId}.json`;

    const response = await fetch(url, {
      headers: { Authorization: this.authHeader },
    });

    const data = await response.json();
    return {
      callId: data.sid || callId,
      status: data.status || 'unknown',
      duration: data.duration ? parseInt(data.duration, 10) : undefined,
      startTime: data.start_time,
      endTime: data.end_time,
      direction: data.direction,
      price: data.price ? parseFloat(data.price) : undefined,
    };
  }

  async getCallRecording(callId: string): Promise<string> {
    const url = `${this.baseUrl}/${this.config.accountSid}/Recordings.json?CallSid=${callId}`;

    const response = await fetch(url, {
      headers: { Authorization: this.authHeader },
    });

    const data = await response.json();
    const recording = data.recordings?.[0];

    if (recording?.uri) {
      return `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
    }
    return '';
  }

  async endCall(callId: string): Promise<boolean> {
    const url = `${this.baseUrl}/${this.config.accountSid}/Calls/${callId}.json`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ Status: 'completed' }),
    });

    return response.ok;
  }

  async sendSMS(to: string, message: string): Promise<SMSResult> {
    const url = `${this.baseUrl}/${this.config.accountSid}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append('To', to);
    formData.append('From', this.config.fromNumber);
    formData.append('Body', message);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const data = await response.json();
    return {
      messageId: data.sid || '',
      status: data.status || 'unknown',
      provider: 'twilio',
    };
  }
}

// ─── Telnyx ──────────────────────────────────────────────────────

export class TelnyxClient extends TelephonyClient {
  private baseUrl = 'https://api.telnyx.com/v2';

  private get authHeader(): string {
    return `Bearer ${this.config.apiKey}`;
  }

  async makeCall(options: CallOptions): Promise<CallResult> {
    const url = `${this.baseUrl}/calls`;

    const payload: Record<string, unknown> = {
      connection_id: this.config.accountSid,
      to: options.to,
      from: this.getFromNumber(options),
      timeout_secs: options.timeout || 60,
    };

    if (options.url) payload.webhook_url = options.url;
    if (options.record) payload.record = 'record-from-answer';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Telnyx API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      callId: data.data.call_control_id,
      status: data.data.state,
      provider: 'telnyx',
    };
  }

  async getCallStatus(callId: string): Promise<CallStatus> {
    // Telnyx relies on webhooks for call status; return minimal info
    return { callId, status: 'unknown' };
  }

  async getCallRecording(callId: string): Promise<string> {
    const url = `${this.baseUrl}/recordings?filter[call_control_id]=${callId}`;

    const response = await fetch(url, {
      headers: { Authorization: this.authHeader },
    });

    const data = await response.json();
    return data.data?.[0]?.recording_urls?.mp3 || '';
  }

  async endCall(callId: string): Promise<boolean> {
    const url = `${this.baseUrl}/calls/${callId}/actions/hangup`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  }

  async sendSMS(to: string, message: string): Promise<SMSResult> {
    const url = `${this.baseUrl}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.fromNumber,
        to,
        text: message,
      }),
    });

    const data = await response.json();
    return {
      messageId: data.data?.id || '',
      status: data.data?.to?.[0]?.status || 'unknown',
      provider: 'telnyx',
    };
  }
}

// ─── Factory ─────────────────────────────────────────────────────

export function createTelephonyClient(config: TelephonyConfig): TelephonyClient {
  switch (config.provider) {
    case 'exotel':
      return new ExotelClient(config);
    case 'twilio':
      return new TwilioClient(config);
    case 'telnyx':
      return new TelnyxClient(config);
    default:
      throw new Error(`Unsupported telephony provider: ${(config as TelephonyConfig).provider}`);
  }
}
