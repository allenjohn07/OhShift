"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RealtimeSubscriber({ companyId }: { companyId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Subscribe to all changes in the `shifts` table for this company
    const shiftsChannel = supabase
      .channel("custom-shifts-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shifts",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log("Realtime shift update:", payload);
          router.refresh();
        }
      )
      .subscribe();

    // Subscribe to all changes in the `users` table for this company
    const usersChannel = supabase
      .channel("custom-users-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log("Realtime user update:", payload);
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(shiftsChannel);
      supabase.removeChannel(usersChannel);
    };
  }, [companyId, router]);

  return null; // This component doesn't render anything visually
}
