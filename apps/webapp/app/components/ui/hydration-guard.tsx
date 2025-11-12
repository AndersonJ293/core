import { useIsHydrated } from "@radix-ui/react-use-is-hydrated";
import { ReactNode } from "react";

interface HydrationGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  skeleton?: ReactNode;
}

/**
 * HydrationGuard prevents hydration mismatches by only rendering children
 * after client-side hydration is complete.
 *
 * This is essential for components that use hooks like useForm which
 * internally call useRef and may cause hydration errors.
 */
export function HydrationGuard({
  children,
  fallback,
  skeleton
}: HydrationGuardProps) {
  const isHydrated = useIsHydrated();

  if (!isHydrated) {
    return fallback ?? skeleton ?? <HydrationSkeleton />;
  }

  return <>{children}</>;
}

function HydrationSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded w-1/3"></div>
    </div>
  );
}