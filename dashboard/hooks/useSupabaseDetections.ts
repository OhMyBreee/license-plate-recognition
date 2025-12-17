// /src/hooks/useSupabaseDetections.ts
"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/context/auth-context";
import type { SupabaseDetection } from "@/types/lpr"; // optional types

export function useSupabaseDetections() {
  const [recentDetections, setRecentDetections] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchDetectionData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: recent } = await supabase
        .from("detections")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      setRecentDetections(recent || []);

      const { count } = await supabase
        .from("detections")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      setTotalCount(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const saveDetection = useCallback(
    async (det: {
      plate_number: string;
      confidence: number;
      status: string;
      time_ms: number;
    }) => {
      if (!user) return null;

      const { data, error } = await supabase
      .from("detections")
      .insert({
        plate_number: det.plate_number,
        confidence: det.confidence,
        status: det.status,
        time_ms: det.time_ms,
        user_id: user.id,
      })
      .select();

      if (error) {
        console.error("Supabase insert error:", {
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return null;
      }
      return data;
    },
    [user]
  );

  return {
    recentDetections,
    totalCount,
    loading,
    fetchDetectionData,
    saveDetection,
  };
}
