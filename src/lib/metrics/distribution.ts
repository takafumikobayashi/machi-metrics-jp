import { quantile } from "@/lib/similarity/calculate";

/**
 * 分布のなかでの位置。
 *
 * 「48.4人/km²」だけでは高いか低いかが分からない。順位と中央値を添えて
 * 比較の文脈を与えるために使う。欠損は順位の対象から外し、0として扱わない。
 */

export interface DistributionPosition {
  /** 降順の順位。同じ値は同じ順位になる。 */
  rank: number;
  /** 順位の母数。欠損を除いた件数。 */
  total: number;
  median: number;
}

export function describePosition(
  value: number | null,
  values: readonly (number | null)[],
): DistributionPosition | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  const known = values.filter(
    (item): item is number => item !== null && Number.isFinite(item),
  );
  if (known.length === 0) {
    return null;
  }

  return {
    rank: known.filter((item) => item > value).length + 1,
    total: known.length,
    median: quantile(known, 0.5),
  };
}
