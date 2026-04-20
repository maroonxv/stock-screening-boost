/* biome-ignore lint/correctness/noUnusedImports: React is required by the current JSX transform in tests. */
import React, { Suspense } from "react";
import { OpportunityIntelligenceClient } from "~/app/opportunity-intelligence/opportunity-intelligence-client";
import { OpportunityIntelligenceLoginRedirectNotice } from "~/app/opportunity-intelligence/opportunity-intelligence-login-redirect-notice";
import { auth } from "~/server/auth";

export default async function OpportunityIntelligencePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <OpportunityIntelligenceLoginRedirectNotice
        redirectTo="/opportunity-intelligence"
      />
    );
  }

  return (
    <Suspense fallback={null}>
      <OpportunityIntelligenceClient />
    </Suspense>
  );
}
