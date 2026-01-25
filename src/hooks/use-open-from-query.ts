"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

/**
 * Hook to handle opening an item from a URL query parameter.
 * Looks for ?open=<id> in the URL, finds the matching item, calls onOpen, and clears the param.
 */
export function useOpenFromQuery<T extends { id: string }>(
  items: T[],
  onOpen: (item: T) => void,
  replacePath: string
) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId && items.length > 0) {
      const item = items.find((i) => i.id === openId);
      if (item) {
        onOpen(item);
        router.replace(replacePath, { scroll: false });
      }
    }
  }, [searchParams, items, router, onOpen, replacePath]);
}
