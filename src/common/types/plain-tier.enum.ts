export enum PlanTier {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  BUSINESS = 'business',
}

export function normalizePlanTier(raw: string | undefined | null) {
  const lower = raw?.toLowerCase();
  if (Object.values(PlanTier).includes(lower as PlanTier))
    return lower as PlanTier;
  return PlanTier.FREE;
}
