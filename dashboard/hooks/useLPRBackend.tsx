// /src/hooks/useLPRBackend.ts
"use client";

import { useState, useCallback } from "react";
import type { MultiPlateResponse, PlateResult } from "@/types/lpr";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/recognize";

export function useLPRBackend() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<MultiPlateResponse | null>(null);

  const recognize = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setResponse(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`API Error: ${res.status} ${text}`);
      }

      const data: MultiPlateResponse = await res.json();
      setResponse(data);
      return data;
    } catch (err: any) {
      setError(err?.message ?? "Unknown error");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, response, recognize, setResponse };
}
