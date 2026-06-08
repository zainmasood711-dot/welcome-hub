import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAccessContext } from "@/lib/phase1.functions";

export function useAccessContext() {
  const fetchAccess = useServerFn(getAccessContext);
  return useQuery({
    queryKey: ["access-context"],
    queryFn: () => fetchAccess(),
    staleTime: 1000 * 60,
  });
}