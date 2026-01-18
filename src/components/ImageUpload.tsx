import React, { useRef, useState } from 'react';
import { Button, Box, Typography } from '@mui/material';
import PhotoCamera from '@mui/icons-material/PhotoCamera';

interface ImageUploadProps {
  onImageUpload: (file: File) => void;
  imageUrl?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onImageUpload, imageUrl }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const maxImageSizeBytes = 2 * 1024 * 1024;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Only image files are supported.');
        return;
      }
      if (file.size > maxImageSizeBytes) {
        setError('Image must be 2 MB or smaller.');
        return;
      }
      setError(null);
      onImageUpload(file);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept="image/*"
      />
      <Button
        variant="outlined"
        size="small"
        startIcon={<PhotoCamera />}
        onClick={handleButtonClick}
      >
        Upload
      </Button>
      {error && (
        <Typography variant="caption" color="error" sx={{ textAlign: 'center' }}>
          {error}
        </Typography>
      )}
      {imageUrl && (
        <img src={imageUrl} alt="preview" style={{ width: '100px', marginTop: '8px' }} />
      )}
    </Box>
  );
};

export default ImageUpload;
