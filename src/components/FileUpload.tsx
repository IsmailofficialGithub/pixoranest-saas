import { useCallback, useRef } from 'react';
import { Upload } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useFileUpload } from '@/hooks/useFileUpload';

interface FileUploadProps {
  bucket: string;
  folder?: string;
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  onUploadComplete: (urls: string[]) => void;
}

export function FileUpload({
  bucket,
  folder,
  accept,
  maxSize = 10 * 1024 * 1024,
  multiple = false,
  onUploadComplete,
}: FileUploadProps) {
  const { upload, uploadMultiple, isUploading, progress, error } = useFileUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const validFiles = Array.from(files).filter((f) => f.size <= maxSize);
      if (validFiles.length === 0) return;

      try {
        if (validFiles.length === 1) {
          const result = await upload(bucket, validFiles[0], folder);
          onUploadComplete([result.url]);
        } else {
          const results = await uploadMultiple(bucket, validFiles, folder);
          onUploadComplete(results.map((r) => r.url));
        }
      } catch (err) {
        console.error('Upload failed:', err);
      }
    },
    [bucket, folder, maxSize, upload, uploadMultiple, onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div className="space-y-3">
      <div
        className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drag and drop files here, or click to select
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Max file size: {(maxSize / 1024 / 1024).toFixed(0)}MB
        </p>
      </div>

      {isUploading && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            Uploading... {progress}%
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}
    </div>
  );
}
