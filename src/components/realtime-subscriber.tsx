"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Polls for schedule updates every 30s. */
export function RealtimeSubscriber({ companyId }: { companyId: string }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 30_000);

    return () => clearInterval(interval);
  }, [companyId, router]);

  return null;
}
