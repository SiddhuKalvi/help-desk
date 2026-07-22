export const replySenderTypes = ["agent", "customer", "ai"] as const;

export type ReplySenderType = (typeof replySenderTypes)[number];
