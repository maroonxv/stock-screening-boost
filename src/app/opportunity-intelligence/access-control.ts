export const OPPORTUNITY_INTELLIGENCE_LOGIN_NOTICE =
  "你尚未登录，正在跳转到登录页。";

export function buildOpportunityIntelligenceLoginHref(redirectTo: string) {
  return `/login?redirectTo=${encodeURIComponent(redirectTo)}`;
}
