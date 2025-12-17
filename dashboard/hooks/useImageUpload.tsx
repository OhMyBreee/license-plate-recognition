// /src/hooks/useImageUpload.ts
"use client";

import { useState, useCallback } from "react";

export function useImageUpload() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageURL, setImageURL] = useState<string | null>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setImageFile(file);
    setImageURL(URL.createObjectURL(file));
    // reset input value if needed is handled by caller
  }, []);

  const clear = useCallback(() => {
    if (imageURL) URL.revokeObjectURL(imageURL);
    setImageFile(null);
    setImageURL(null);
  }, [imageURL]);

  return { imageFile, imageURL, handleFileChange, clear };
}
