"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PersonalPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/personal/inbox");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-pulse text-muted-foreground">Redirecting...</div>
    </div>
  );
}
