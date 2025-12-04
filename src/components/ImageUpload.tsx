import React, { useRef } from 'react';
import { Button, Box, Typography } from '@mui/material';
import PhotoCamera from '@mui/icons-material/PhotoCamera';

interface ImageUploadProps {
  onImageUpload: (file: File) => void;
  imageUrl?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onImageUpload, imageUrl }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
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
      {imageUrl && (
        <img src={imageUrl} alt="preview" style={{ width: '100px', marginTop: '8px' }} />
      )}
    </Box>
  );
};

export default ImageUpload;
