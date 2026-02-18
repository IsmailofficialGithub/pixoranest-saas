export interface SocialMediaConfig {
  platform: 'facebook' | 'instagram' | 'linkedin' | 'twitter';
  accessToken: string;
  accountId: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface SocialMediaPost {
  content: string;
  mediaUrls?: string[];
  hashtags?: string[];
  mentions?: string[];
  linkPreview?: boolean;
  firstComment?: string;
}

export interface PostResult {
  platform: string;
  postId: string;
  postUrl: string;
  publishedAt: Date;
}

export interface EngagementStats {
  likes: number;
  comments: number;
  shares: number;
  impressions?: number;
}

// ─── Base Class ───────────────────────────────────────────────

export abstract class SocialMediaClient {
  protected config: SocialMediaConfig;

  constructor(config: SocialMediaConfig) {
    this.config = config;
  }

  abstract post(post: SocialMediaPost): Promise<PostResult>;
  abstract getPost(postId: string): Promise<any>;
  abstract getEngagement(postId: string): Promise<EngagementStats>;
  abstract deletePost(postId: string): Promise<boolean>;
}

// ─── Facebook ─────────────────────────────────────────────────

export class FacebookClient extends SocialMediaClient {
  private baseUrl = 'https://graph.facebook.com/v18.0';

  async post(post: SocialMediaPost): Promise<PostResult> {
    const payload: any = {
      message: post.content,
      access_token: this.config.accessToken,
    };

    if (post.mediaUrls?.length) {
      if (post.mediaUrls.length === 1) {
        const type = this.mediaType(post.mediaUrls[0]);
        if (type === 'image') payload.url = post.mediaUrls[0];
        else if (type === 'video') payload.file_url = post.mediaUrls[0];
      } else {
        payload.attached_media = await this.uploadMultipleImages(post.mediaUrls);
      }
    }

    const res = await fetch(`${this.baseUrl}/${this.config.accountId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Facebook API error: ${JSON.stringify(await res.json())}`);
    const data = await res.json();

    return { platform: 'facebook', postId: data.id, postUrl: `https://facebook.com/${data.id}`, publishedAt: new Date() };
  }

  async getPost(postId: string) {
    const res = await fetch(
      `${this.baseUrl}/${postId}?fields=message,created_time,permalink_url&access_token=${this.config.accessToken}`
    );
    return res.json();
  }

  async getEngagement(postId: string): Promise<EngagementStats> {
    const res = await fetch(
      `${this.baseUrl}/${postId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${this.config.accessToken}`
    );
    const data = await res.json();
    return {
      likes: data.likes?.summary?.total_count || 0,
      comments: data.comments?.summary?.total_count || 0,
      shares: data.shares?.count || 0,
    };
  }

  async deletePost(postId: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/${postId}?access_token=${this.config.accessToken}`, { method: 'DELETE' });
    return res.ok;
  }

  private mediaType(url: string): 'image' | 'video' | 'unknown' {
    if (/\.(jpg|jpeg|png|gif)$/i.test(url)) return 'image';
    if (/\.(mp4|mov|avi)$/i.test(url)) return 'video';
    return 'unknown';
  }

  private async uploadMultipleImages(urls: string[]) {
    return Promise.all(
      urls.map(async (url) => {
        const res = await fetch(`${this.baseUrl}/${this.config.accountId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, published: false, access_token: this.config.accessToken }),
        });
        const data = await res.json();
        return { media_fbid: data.id };
      })
    );
  }
}

// ─── Instagram ────────────────────────────────────────────────

export class InstagramClient extends SocialMediaClient {
  private baseUrl = 'https://graph.facebook.com/v18.0';

  async post(post: SocialMediaPost): Promise<PostResult> {
    if (!post.mediaUrls?.length) throw new Error('Instagram posts require media');

    const caption = post.content + (post.hashtags?.length ? '\n\n' + post.hashtags.join(' ') : '');

    // Step 1 – container
    const containerPayload: any = { caption, access_token: this.config.accessToken };

    if (post.mediaUrls.length === 1) {
      const isVideo = /\.(mp4|mov)$/i.test(post.mediaUrls[0]);
      if (isVideo) {
        containerPayload.media_type = 'VIDEO';
        containerPayload.video_url = post.mediaUrls[0];
      } else {
        containerPayload.image_url = post.mediaUrls[0];
      }
    } else {
      containerPayload.media_type = 'CAROUSEL';
      containerPayload.children = await this.createCarouselChildren(post.mediaUrls);
    }

    const cRes = await fetch(`${this.baseUrl}/${this.config.accountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerPayload),
    });
    if (!cRes.ok) throw new Error(`Instagram container error: ${JSON.stringify(await cRes.json())}`);
    const containerId = (await cRes.json()).id;

    // Step 2 – publish
    const pRes = await fetch(`${this.baseUrl}/${this.config.accountId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: containerId, access_token: this.config.accessToken }),
    });
    if (!pRes.ok) throw new Error(`Instagram publish error: ${JSON.stringify(await pRes.json())}`);
    const publishData = await pRes.json();

    // Step 3 – first comment
    if (post.firstComment) {
      await fetch(`${this.baseUrl}/${publishData.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: post.firstComment, access_token: this.config.accessToken }),
      });
    }

    return { platform: 'instagram', postId: publishData.id, postUrl: `https://instagram.com/p/${publishData.id}`, publishedAt: new Date() };
  }

  async getPost(postId: string) {
    const res = await fetch(
      `${this.baseUrl}/${postId}?fields=caption,media_type,media_url,permalink,timestamp&access_token=${this.config.accessToken}`
    );
    return res.json();
  }

  async getEngagement(postId: string): Promise<EngagementStats> {
    const res = await fetch(
      `${this.baseUrl}/${postId}?fields=like_count,comments_count&access_token=${this.config.accessToken}`
    );
    const data = await res.json();
    return { likes: data.like_count || 0, comments: data.comments_count || 0, shares: 0 };
  }

  async deletePost(postId: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/${postId}?access_token=${this.config.accessToken}`, { method: 'DELETE' });
    return res.ok;
  }

  private async createCarouselChildren(urls: string[]) {
    return Promise.all(
      urls.map(async (url) => {
        const res = await fetch(`${this.baseUrl}/${this.config.accountId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token: this.config.accessToken }),
        });
        return (await res.json()).id;
      })
    );
  }
}

// ─── LinkedIn ─────────────────────────────────────────────────

export class LinkedInClient extends SocialMediaClient {
  private baseUrl = 'https://api.linkedin.com/v2';
  private headers() {
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    };
  }

  async post(post: SocialMediaPost): Promise<PostResult> {
    const shareContent: any = {
      shareCommentary: { text: post.content },
      shareMediaCategory: post.mediaUrls?.length ? 'IMAGE' : 'NONE',
    };

    if (post.mediaUrls?.length) {
      shareContent.media = post.mediaUrls.map((url) => ({
        status: 'READY',
        description: { text: 'Image' },
        media: url,
        title: { text: 'Post Image' },
      }));
    }

    const payload = {
      author: `urn:li:person:${this.config.accountId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: { 'com.linkedin.ugc.ShareContent': shareContent },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };

    const res = await fetch(`${this.baseUrl}/ugcPosts`, { method: 'POST', headers: this.headers(), body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`LinkedIn API error: ${JSON.stringify(await res.json())}`);
    const data = await res.json();

    return { platform: 'linkedin', postId: data.id, postUrl: `https://linkedin.com/feed/update/${data.id}`, publishedAt: new Date() };
  }

  async getPost(postId: string) {
    const res = await fetch(`${this.baseUrl}/ugcPosts/${postId}`, { headers: this.headers() });
    return res.json();
  }

  async getEngagement(postId: string): Promise<EngagementStats> {
    const res = await fetch(`${this.baseUrl}/socialActions/${postId}`, { headers: this.headers() });
    const data = await res.json();
    return {
      likes: data.likesSummary?.totalLikes || 0,
      comments: data.commentsSummary?.totalFirstLevelComments || 0,
      shares: 0,
    };
  }

  async deletePost(postId: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/ugcPosts/${postId}`, { method: 'DELETE', headers: this.headers() });
    return res.ok;
  }
}

// ─── Twitter / X ──────────────────────────────────────────────

export class TwitterClient extends SocialMediaClient {
  private baseUrl = 'https://api.x.com/2';

  async post(post: SocialMediaPost): Promise<PostResult> {
    let text = post.content;
    if (text.length > 280) text = text.substring(0, 277) + '...';

    const payload: any = { text };

    if (post.mediaUrls?.length) {
      const mediaIds = await this.uploadMedia(post.mediaUrls);
      if (mediaIds.length) payload.media = { media_ids: mediaIds };
    }

    const res = await fetch(`${this.baseUrl}/tweets`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Twitter API error: ${JSON.stringify(await res.json())}`);
    const data = await res.json();

    return { platform: 'twitter', postId: data.data.id, postUrl: `https://twitter.com/i/web/status/${data.data.id}`, publishedAt: new Date() };
  }

  async getPost(postId: string) {
    const res = await fetch(`${this.baseUrl}/tweets/${postId}?tweet.fields=created_at,text,public_metrics`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    });
    return res.json();
  }

  async getEngagement(postId: string): Promise<EngagementStats> {
    const res = await fetch(`${this.baseUrl}/tweets/${postId}?tweet.fields=public_metrics`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    });
    const m = (await res.json()).data?.public_metrics || {};
    return { likes: m.like_count || 0, comments: m.reply_count || 0, shares: m.retweet_count || 0, impressions: m.impression_count || 0 };
  }

  async deletePost(postId: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/tweets/${postId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    });
    return res.ok;
  }

  private async uploadMedia(_urls: string[]): Promise<string[]> {
    // Twitter media upload requires v1.1 API with OAuth 1.0a – implement in edge function
    return [];
  }
}

// ─── Factory & Multi-platform Helper ──────────────────────────

export function createSocialMediaClient(config: SocialMediaConfig): SocialMediaClient {
  switch (config.platform) {
    case 'facebook': return new FacebookClient(config);
    case 'instagram': return new InstagramClient(config);
    case 'linkedin': return new LinkedInClient(config);
    case 'twitter': return new TwitterClient(config);
    default: throw new Error(`Unsupported platform: ${config.platform}`);
  }
}

export async function postToMultiplePlatforms(
  platforms: SocialMediaConfig[],
  post: SocialMediaPost
): Promise<PostResult[]> {
  const results = await Promise.allSettled(
    platforms.map((cfg) => createSocialMediaClient(cfg).post(post))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<PostResult> => r.status === 'fulfilled')
    .map((r) => r.value);
}
