export interface WhatsAppConfig {
  businessAccountId: string;
  phoneNumberId: string;
  accessToken: string;
  webhookVerifyToken?: string;
}

export interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template' | 'image' | 'video' | 'document';
  text?: {
    body: string;
    preview_url?: boolean;
  };
  template?: {
    name: string;
    language: { code: string };
    components: any[];
  };
  image?: {
    link: string;
    caption?: string;
  };
  video?: {
    link: string;
    caption?: string;
  };
  document?: {
    link: string;
    caption?: string;
    filename?: string;
  };
}

export interface WhatsAppSendResult {
  messageId: string;
  waId: string;
}

export interface WhatsAppWebhookEvent {
  type: 'message' | 'status' | 'unknown';
  data: any;
}

export class WhatsAppClient {
  private config: WhatsAppConfig;
  private baseUrl: string = 'https://graph.facebook.com/v18.0';

  constructor(config: WhatsAppConfig) {
    this.config = config;
  }

  async sendMessage(message: WhatsAppMessage): Promise<WhatsAppSendResult> {
    const response = await fetch(
      `${this.baseUrl}/${this.config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: message.to.replace(/\+/g, ''),
          type: message.type,
          ...this.formatMessagePayload(message),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      messageId: data.messages?.[0]?.id,
      waId: data.contacts?.[0]?.wa_id,
    };
  }

  async sendTextMessage(to: string, text: string): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to,
      type: 'text',
      text: { body: text, preview_url: true },
    });
  }

  async sendTemplateMessage(
    to: string,
    templateName: string,
    variables: string[]
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: variables.map((v) => ({ type: 'text', text: v })),
          },
        ],
      },
    });
  }

  async sendImageMessage(
    to: string,
    imageUrl: string,
    caption?: string
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to,
      type: 'image',
      image: { link: imageUrl, caption },
    });
  }

  async sendVideoMessage(
    to: string,
    videoUrl: string,
    caption?: string
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to,
      type: 'video',
      video: { link: videoUrl, caption },
    });
  }

  async sendDocumentMessage(
    to: string,
    documentUrl: string,
    filename?: string,
    caption?: string
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to,
      type: 'document',
      document: { link: documentUrl, filename, caption },
    });
  }

  async markAsRead(messageId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
          }),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async getMediaUrl(mediaId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${this.config.accessToken}` },
    });

    if (!response.ok) {
      throw new Error('Failed to get media URL');
    }

    const data = await response.json();
    return data.url;
  }

  async uploadMedia(file: Blob, mimeType: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', mimeType);

    const response = await fetch(
      `${this.baseUrl}/${this.config.phoneNumberId}/media`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.config.accessToken}` },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to upload media: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.id;
  }

  async getTemplates(): Promise<any[]> {
    const response = await fetch(
      `${this.baseUrl}/${this.config.businessAccountId}/message_templates`,
      {
        headers: { 'Authorization': `Bearer ${this.config.accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get templates');
    }

    const data = await response.json();
    return data.data;
  }

  async createTemplate(template: {
    name: string;
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
    language: string;
    components: any[];
  }) {
    const response = await fetch(
      `${this.baseUrl}/${this.config.businessAccountId}/message_templates`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(template),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create template: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }

  verifyWebhook(mode: string, token: string, challenge: string): string {
    if (mode === 'subscribe' && token === this.config.webhookVerifyToken) {
      return challenge;
    }
    throw new Error('Webhook verification failed');
  }

  processWebhook(payload: any): WhatsAppWebhookEvent {
    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value?.messages?.[0]) {
      const msg = value.messages[0];
      return {
        type: 'message',
        data: {
          from: msg.from,
          messageId: msg.id,
          timestamp: msg.timestamp,
          type: msg.type,
          text: msg.text?.body,
          image: msg.image,
          video: msg.video,
          document: msg.document,
        },
      };
    }

    if (value?.statuses?.[0]) {
      const status = value.statuses[0];
      return {
        type: 'status',
        data: {
          messageId: status.id,
          status: status.status,
          timestamp: status.timestamp,
          recipientId: status.recipient_id,
          errors: status.errors,
        },
      };
    }

    return { type: 'unknown', data: payload };
  }

  private formatMessagePayload(message: WhatsAppMessage) {
    const payload: any = {};
    if (message.type === 'text' && message.text) payload.text = message.text;
    if (message.type === 'template' && message.template) payload.template = message.template;
    if (message.type === 'image' && message.image) payload.image = message.image;
    if (message.type === 'video' && message.video) payload.video = message.video;
    if (message.type === 'document' && message.document) payload.document = message.document;
    return payload;
  }
}
