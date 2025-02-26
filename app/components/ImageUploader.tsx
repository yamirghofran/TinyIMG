import React, { useRef, useState } from 'react';

interface ImageUploaderProps {
  onImageUpload: (imageData: ImageData, format: string) => void;
}

export function ImageUploader({ onImageUpload }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    setError(null);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create a canvas to get the image data
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Could not process image');
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        
        // Extract format from file type
        const format = file.type.split('/')[1].toUpperCase();
        
        onImageUpload(imageData, format);
      };
      
      img.onerror = () => {
        setError('Failed to load image');
      };
      
      img.src = event.target?.result as string;
    };
    
    reader.onerror = () => {
      setError('Failed to read file');
    };
    
    reader.readAsDataURL(file);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <div 
      className={`image-uploader ${isDragging ? 'dragging' : ''}`}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z" fill="#ccc"/>
      </svg>
      <p>Drag & drop an image or click to browse</p>
      {error && <p className="error-message">{error}</p>}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleChange}
        accept="image/*"
      />
    </div>
  );
} 