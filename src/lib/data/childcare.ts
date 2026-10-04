import {
  childcareCategories,
  type ChildcareCategory,
} from "./childcare-schema";

/**
 * URLのカテゴリー指定を解釈する。指定が無いか不正な場合は、カテゴリーの
 * 並びの先頭（妊娠・出産支援）を選ぶ。初期値を並び順に合わせ、テーマを
 * 開いたときに途中のカテゴリーが選ばれた状態にしない。
 */
export function resolveChildcareCategory(
  value: string | undefined,
): ChildcareCategory {
  return childcareCategories.includes(value as ChildcareCategory)
    ? (value as ChildcareCategory)
    : childcareCategories[0];
}
