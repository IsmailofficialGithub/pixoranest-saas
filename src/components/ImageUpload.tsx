import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileUpload } from './FileUpload';

interface ImageUploadProps {
  bucket: string;
  folder?: string;
  maxImages?: number;
  onUploadComplete: (urls: string[]) => void;
}

export function ImageUpload({
  bucket,
  folder,
  maxImages = 10,
  onUploadComplete,
}: ImageUploadProps) {
  const [images, setImages] = useState<string[]>([]);

  const handleUpload = (urls: string[]) => {
    const newImages = [...images, ...urls].slice(0, maxImages);
    setImages(newImages);
    onUploadComplete(newImages);
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    onUploadComplete(newImages);
  };

  return (
    <div className="space-y-4">
      {images.length < maxImages && (
        <FileUpload
          bucket={bucket}
          folder={folder}
          accept="image/*"
          multiple
          onUploadComplete={handleUpload}
        />
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((url, index) => (
            <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeImage(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {images.length} / {maxImages} images uploaded
        </p>
      )}
    </div>
  );
}
