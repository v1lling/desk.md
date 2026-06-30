
import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

/**
 * Hook to handle opening an item from a URL query parameter.
 * Looks for ?open=<id> in the URL, finds the matching item, calls onOpen, and clears the param.
 */
export function useOpenFromQuery<T extends { id: string }>(
  items: T[],
  onOpen: (item: T) => void,
  replacePath: string
) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId && items.length > 0) {
      const item = items.find((i) => i.id === openId);
      if (item) {
        onOpen(item);
        navigate(replacePath, { replace: true });
      }
    }
  }, [searchParams, items, navigate, onOpen, replacePath]);
}
