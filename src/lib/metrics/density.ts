/** 人口と行政区域面積から人口密度（人/km²）を計算する。 */
export function calculatePopulationDensity(
  population: number | null,
  areaKm2: number | null,
): number | null {
  if (population === null || areaKm2 === null || areaKm2 <= 0) {
    return null;
  }
  return population / areaKm2;
}

/** 人口密度を画面で小数1桁に整える前の、公開JSON用の値を丸める。 */
export function roundPopulationDensity(value: number | null): number | null {
  if (value === null) {
    return null;
  }
  return Number(value.toFixed(1));
}
