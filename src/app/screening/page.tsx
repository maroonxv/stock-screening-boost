import { Suspense } from "react";
import { ScreeningStudioClient } from "~/app/screening/screening-studio-client";

export default function ScreeningPage() {
  return (
    <Suspense fallback={null}>
      <ScreeningStudioClient />
    </Suspense>
  );
}
