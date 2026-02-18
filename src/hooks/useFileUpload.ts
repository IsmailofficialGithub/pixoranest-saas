import { useState } from 'react';
import { uploadFile, uploadMultipleFiles, type UploadResult } from '@/lib/storage';

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = async (bucket: string, file: File, folder?: string): Promise<UploadResult> => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      const result = await uploadFile({
        bucket,
        file,
        folder,
        onProgress: setProgress,
      });
      setProgress(100);
      return result;
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  const uploadMultiple = async (
    bucket: string,
    files: File[],
    folder?: string
  ): Promise<UploadResult[]> => {
    setIsUploading(true);
    setError(null);

    try {
      const results = await uploadMultipleFiles(bucket, files, folder);
      return results;
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return { upload, uploadMultiple, isUploading, progress, error };
}
