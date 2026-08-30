export type AnalyticsRuntimeEnvironment = {
  nodeEnv?: string;
  measurementId?: string;
};

export type AnalyticsRuntimeConfig = {
  enabled: boolean;
  measurementId: string | null;
};

export function getAnalyticsRuntimeConfig(
  runtime: AnalyticsRuntimeEnvironment = {
    nodeEnv: process.env.NODE_ENV,
    measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  },
): AnalyticsRuntimeConfig {
  const measurementId = runtime.measurementId?.trim() || null;

  return {
    enabled: runtime.nodeEnv === "production" && measurementId !== null,
    measurementId,
  };
}
