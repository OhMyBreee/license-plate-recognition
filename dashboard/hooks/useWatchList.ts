// /src/hooks/useWatchList.ts
"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/context/auth-context";

export function useWatchList() {
  const [watchList, setWatchList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  /* ---------------- FETCH ---------------- */
  const fetchWatchList = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("watch_list")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Fetch watchlist error:", error);
        return;
      }

      setWatchList(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  /* ---------------- ADD ---------------- */
  const addPlate = useCallback(
    async (plate: string) => {
      if (!user) return;

      const { error } = await supabase
        .from("watch_list")
        .insert({
          plate_number: plate,
          status: "not_detected", // MUST match enum
          user_id: user.id,       // REQUIRED for RLS
        })
        .select();

      if (error) {
        console.error("Add watchlist error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        return;
      }

      fetchWatchList();
    },
    [user, fetchWatchList]
  );

  /* ---------------- REMOVE ---------------- */
  const removePlate = useCallback(
    async (plate: string) => {
      if (!user) return;

      const { error } = await supabase
        .from("watch_list")
        .delete()
        .eq("plate_number", plate)
        .eq("user_id", user.id); // important for RLS

      if (error) {
        console.error("Remove watchlist error:", error);
        return;
      }

      fetchWatchList();
    },
    [user, fetchWatchList]
  );

  return {
    watchList,
    loading,
    fetchWatchList,
    addPlate,
    removePlate,
  };
}
