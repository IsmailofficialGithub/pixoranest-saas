import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CreatePostOptions {
  platforms: string[];
  content: string;
  mediaUrls?: string[];
  hashtags?: string[];
  scheduledAt?: string;
}

export function useSocialMedia() {
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPost = async (options: CreatePostOptions) => {
    setIsPosting(true);
    setError(null);

    try {
      const { data, error: postError } = await supabase.functions.invoke(
        'create-social-post',
        { body: options }
      );

      if (postError) throw postError;
      return data;
    } catch (err: any) {
      const message = err.message || 'Failed to create post';
      setError(message);
      throw err;
    } finally {
      setIsPosting(false);
    }
  };

  return { createPost, isPosting, error };
}
