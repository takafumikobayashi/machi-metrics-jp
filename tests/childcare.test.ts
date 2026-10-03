import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";

import { ChildcareDashboard } from "../src/components/childcare/ChildcareDashboard";
import { ChildcareDetailPanel } from "../src/components/childcare/ChildcareDetailPanel";
import { hiroshimaMunicipalities } from "../src/lib/config";
import {
  childcareFileSchema,
  type ChildcareFile,
} from "../src/lib/data/childcare-schema";
import { loadChildcare } from "../src/lib/data/load";

let cached: ChildcareFile | null = null;

async function childcare() {
  cached ??= await loadChildcare();
  return cached;
}

test("子育て支援データは23市町を設定順に持つ", async () => {
  const file = await childcare();
  assert.deepEqual(
    file.municipalities.map(({ municipalityCode }) => municipalityCode),
    hiroshimaMunicipalities.map(({ code }) => code),
  );
  assert.equal(file.source.referenceDate, "2026-10-03");
  assert.doesNotThrow(() => childcareFileSchema.parse(file));
});

test("保育料の条件は制度と分離され、指定サンプルを保持する", async () => {
  const file = await childcare();
  const akitakataMeasures = file.measures.filter(
    ({ municipalityCode }) => municipalityCode === "34214",
  );
  const feeSecond = akitakataMeasures.find(
    ({ id }) => id === "akitakata-childcare-fee-second-half",
  );
  assert.equal(feeSecond?.childOrder, 2);
  assert.equal(feeSecond?.amount, 50);
  assert.equal(feeSecond?.incomeLimit, "所得制限なし");
  assert.match(feeSecond?.conditions ?? "", /18歳以下の兄弟姉妹/);
  const akiotaThird = file.measures.find(
    ({ id }) => id === "akiota-childcare-fee-third-free",
  );
  assert.equal(akiotaThird?.childOrder, 3);
  assert.equal(akiotaThird?.userCost, "無料");
  assert.match(akiotaThird?.conditions ?? "", /町税.*滞納/);
  assert.ok(
    file.programs.some(
      ({ id }) => id === "akitakata-childcare-fee-multi-child",
    ),
  );
  assert.ok(file.programs.some(({ id }) => id === "shobara-birth-gift"));
  assert.ok(
    file.programs.some(({ id }) => id === "kitahiroshima-childcare-fee-free"),
  );
  assert.ok(file.programs.some(({ id }) => id === "akitakata-child-medical"));
});

test("妊娠・出産支援は公式確認済みの23市町をカバーする", async () => {
  const file = await childcare();
  const pregnancyPrograms = file.programs.filter(
    ({ category }) => category === "pregnancy_birth",
  );
  assert.equal(
    new Set(pregnancyPrograms.map(({ municipalityCode }) => municipalityCode))
      .size,
    23,
  );
  const shobara = file.programs.find(({ id }) => id === "shobara-birth-gift");
  assert.match(shobara?.notes ?? "", /子どもと同居/);
  assert.match(shobara?.notes ?? "", /1年以上/);
  assert.match(shobara?.notes ?? "", /60日以内/);
  const akitakata = file.programs.find(
    ({ id }) => id === "akitakata-birth-gift",
  );
  assert.equal(
    akitakata?.sourceUrl,
    "https://www.akitakata.jp/ja/shisei/section/kosodate/q116/",
  );
  assert.match(akitakata?.notes ?? "", /30日以内/);
  assert.match(akitakata?.notes ?? "", /市税等の滞納/);
  const miyoshi = file.programs.find(
    ({ id }) => id === "miyoshi-pregnancy-support-benefit",
  );
  assert.match(miyoshi?.summary ?? "", /赤ちゃん訪問/);
  const otake = file.programs.find(
    ({ id }) => id === "otake-pregnancy-support-benefit",
  );
  assert.match(otake?.summary ?? "", /産後2か月頃/);
  const akiota = file.programs.find(
    ({ id }) => id === "akiota-pregnancy-support",
  );
  assert.match(akiota?.summary ?? "", /合計10万円/);
  const kitahiroshima = file.programs.find(
    ({ id }) => id === "kitahiroshima-pregnancy-transport",
  );
  assert.match(kitahiroshima?.summary ?? "", /上限4回/);
  assert.match(kitahiroshima?.summary ?? "", /最大25,000円/);
  const osakikamijima = file.programs.find(
    ({ id }) => id === "osakikamijima-pregnancy-checkups",
  );
  assert.match(osakikamijima?.summary ?? "", /上限5,000円/);
  const sera = file.programs.find(
    ({ id }) => id === "sera-pregnancy-support-benefit",
  );
  assert.match(sera?.summary ?? "", /1回2,000円/);
  assert.ok(
    file.programs.some(({ id }) => id === "shobara-pregnancy-support-benefit"),
  );
  assert.ok(
    file.programs.some(
      ({ id }) => id === "akitakata-pregnancy-support-benefit",
    ),
  );
});

test("子育て支援比較は未掲載カテゴリを制度なしと推測せず表示する", async () => {
  const file = await childcare();
  const markup = renderToStaticMarkup(
    ChildcareDashboard({ data: file, selectedCategory: "age_0_2" }),
  );
  assert.match(markup, /広島県23市町の子育て支援/);
  assert.match(markup, /未掲載のカテゴリは制度がないとは扱わず/);
  assert.match(markup, /childcare-status-cell--available/);
  assert.match(markup, /childcare-status-cell--missing/);
  assert.match(markup, /制度掲載あり/);
  assert.match(markup, /安芸高田市/);
});

test("0〜2歳・保育料は23市町の制度と実費の注意書きを表示する", async () => {
  const file = await childcare();
  const feePrograms = file.programs.filter(
    ({ category }) => category === "age_0_2",
  );
  assert.equal(
    new Set(feePrograms.map(({ municipalityCode }) => municipalityCode)).size,
    23,
  );
  const markup = renderToStaticMarkup(
    ChildcareDashboard({ data: file, selectedCategory: "age_0_2" }),
  );
  assert.match(markup, /住民税非課税世帯/);
  assert.match(markup, /延長保育料・送迎費・教材費・行事費/);
  assert.match(
    file.programs.find(({ id }) => id === "hiroshima-childcare-fee-multi")
      ?.summary ?? "",
    /第2子は半額.*第3子以降は無料/,
  );
  assert.match(
    file.programs.find(({ id }) => id === "fuchu-city-childcare-fee-free")
      ?.summary ?? "",
    /0〜2歳児の保育料を無償化/,
  );
  assert.match(
    file.programs.find(({ id }) => id === "hatsukaichi-childcare-fee-reduction")
      ?.summary ?? "",
    /第1子.*半額.*第3子以降.*無料/,
  );
  assert.equal(
    file.programs.find(({ id }) => id === "kure-childcare-fee-free-0-2")
      ?.sourceUrl,
    "https://www.city.kure.lg.jp/uploaded/attachment/111989.pdf",
  );
  const akitakata = file.measures.find(
    ({ id }) => id === "akitakata-childcare-fee-second-half",
  );
  assert.match(akitakata?.conditions ?? "", /18歳以下/);
});

test("健診・相談は23市町の基本健診と自治体独自制度を表示する", async () => {
  const file = await childcare();
  const checkupPrograms = file.programs.filter(
    ({ category }) => category === "checkups_consultation",
  );
  assert.equal(
    new Set(checkupPrograms.map(({ municipalityCode }) => municipalityCode))
      .size,
    23,
  );
  assert.ok(
    checkupPrograms.some(({ id }) => id === "hiroshima-basic-checkups"),
  );
  const akitakata = checkupPrograms.find(
    ({ id }) => id === "akitakata-extra-checkups",
  );
  assert.match(akitakata?.summary ?? "", /10か月児相談/);
  assert.match(akitakata?.sourceUrl ?? "", /hahatokokenkou/);
  assert.match(
    checkupPrograms.find(({ id }) => id === "hiroshima-extra-checkups")
      ?.summary ?? "",
    /2027年度から全員対象/,
  );
  assert.match(
    checkupPrograms.find(({ id }) => id === "takehara-extra-checkups")
      ?.summary ?? "",
    /育児・栄養・離乳食に関する相談/,
  );
  assert.match(
    checkupPrograms.find(({ id }) => id === "shobara-extra-checkups")
      ?.summary ?? "",
    /2歳児歯科健診/,
  );
  assert.match(
    checkupPrograms.find(({ id }) => id === "fuchucho-extra-checkups")
      ?.summary ?? "",
    /子育て・育ちに関する個別相談/,
  );
  assert.match(
    checkupPrograms.find(({ id }) => id === "jinsekikogen-extra-checkups")
      ?.summary ?? "",
    /4・6・9・12か月児健診/,
  );
  assert.match(
    checkupPrograms.find(({ id }) => id === "kure-extra-checkups")?.summary ??
      "",
    /5歳児発達相談/,
  );
  assert.match(
    checkupPrograms.find(({ id }) => id === "osakikamijima-extra-checkups")
      ?.summary ?? "",
    /乳児一般健診4回/,
  );
  const markup = renderToStaticMarkup(
    ChildcareDashboard({
      data: file,
      selectedCategory: "checkups_consultation",
    }),
  );
  assert.match(markup, /県内共通の基本健診と、市町独自の健診・相談/);
  assert.match(markup, /委託医療機関で受診する形式/);
  assert.match(markup, /受診票の枚数/);
  assert.match(markup, /広島市/);
  assert.match(markup, /安芸高田市/);
  assert.doesNotMatch(
    markup,
    /childcare-status-cell childcare-status-cell--missing/,
  );
});

test("保育・一時預かりは23市町の制度とサービス別の条件を表示する", async () => {
  const file = await childcare();
  const servicePrograms = file.programs.filter(
    ({ category }) => category === "childcare_services",
  );
  assert.equal(
    new Set(servicePrograms.map(({ municipalityCode }) => municipalityCode))
      .size,
    23,
  );
  const akitakata = servicePrograms.find(
    ({ id }) => id === "akitakata-family-support",
  );
  assert.match(akitakata?.summary ?? "", /日・祝日・年末年始は350円/);
  assert.match(akitakata?.summary ?? "", /病後児は500円/);
  assert.match(akitakata?.summary ?? "", /宿泊は4,000円/);
  assert.match(akitakata?.summary ?? "", /1か月あたり2日まで/);
  assert.doesNotMatch(akitakata?.summary ?? "", /1月2日/);
  assert.equal(
    servicePrograms.find(({ id }) => id === "akitakata-sick-child-care-room")
      ?.sourceUrl,
    "https://www.akitakata.jp/ja/shisei/section/kosodate/p156/",
  );
  assert.match(
    servicePrograms.find(({ id }) => id === "akitakata-temporary-care")
      ?.summary ?? "",
    /1日2,000円、半日1,000円/,
  );
  assert.match(
    servicePrograms.find(({ id }) => id === "miyoshi-childcare-services")
      ?.summary ?? "",
    /一時預かり.*病児・病後児保育/,
  );
  assert.match(
    servicePrograms.find(({ id }) => id === "jinsekikogen-childcare-services")
      ?.summary ?? "",
    /一時預かりと病後児保育/,
  );
  assert.ok(servicePrograms.some(({ id }) => id === "kure-family-support"));
  assert.ok(
    servicePrograms.some(({ id }) => id === "hatsukaichi-holiday-care"),
  );
  assert.ok(servicePrograms.some(({ id }) => id === "etajima-sick-child-care"));
  assert.ok(servicePrograms.some(({ id }) => id === "kumano-temporary-care"));
  for (const id of [
    "miyoshi-universal-childcare",
    "kumano-universal-childcare",
    "akitakata-universal-childcare",
  ]) {
    assert.ok(servicePrograms.some((program) => program.id === id));
  }
  const markup = renderToStaticMarkup(
    ChildcareDashboard({
      data: file,
      selectedCategory: "childcare_services",
    }),
  );
  assert.match(markup, /一時預かり、休日保育、病児・病後児保育/);
  assert.match(markup, /こども誰でも通園制度/);
  assert.match(markup, /医師の診療情報提供書/);
  assert.doesNotMatch(
    markup,
    /childcare-status-cell childcare-status-cell--missing/,
  );
});

test("給食費は保育施設と学校給食を分け、学校給食は23市町を持つ", async () => {
  const file = await childcare();
  const childcareMeals = file.programs.filter(
    ({ category }) => category === "school_meals",
  );
  const schoolLunch = file.programs.filter(
    ({ category }) => category === "school_lunch",
  );
  assert.equal(childcareMeals.length, 9);
  assert.equal(schoolLunch.length, 23);
  assert.equal(
    new Set(schoolLunch.map(({ municipalityCode }) => municipalityCode)).size,
    23,
  );
  assert.match(
    schoolLunch.find(({ id }) => id === "takehara-school-lunch-free")
      ?.summary ?? "",
    /小・中・義務教育学校.*無償化/,
  );
  assert.match(
    schoolLunch.find(({ id }) => id === "fuchucho-school-lunch-fee")?.summary ??
      "",
    /小学校60円／食.*中学校350円／食/,
  );
  assert.match(
    schoolLunch.find(({ id }) => id === "higashihiroshima-school-lunch-support")
      ?.summary ?? "",
    /小学校.*0円.*中学校.*280円/,
  );
  assert.match(
    schoolLunch.find(({ id }) => id === "kure-school-lunch-support")?.summary ??
      "",
    /小学校を1年間実質無償化.*3か月無料化/,
  );
  assert.match(
    schoolLunch.find(({ id }) => id === "kumano-school-lunch-free")?.summary ??
      "",
    /小学校.*無償化.*中学校.*物価高騰分/,
  );
  assert.match(
    schoolLunch.find(({ id }) => id === "osakikamijima-school-lunch-support")
      ?.summary ?? "",
    /小学校・中学校.*無償化/,
  );
  const markup = renderToStaticMarkup(
    ChildcareDashboard({ data: file, selectedCategory: "school_lunch" }),
  );
  const mealsMarkup = renderToStaticMarkup(
    ChildcareDashboard({ data: file, selectedCategory: "school_meals" }),
  );
  assert.match(markup, /小学校・中学校の学校給食費/);
  assert.match(markup, /対象学年/);
  assert.match(markup, /国の基準額だけで完全無料になるとは限らず/);
  assert.match(markup, /竹原市/);
  assert.match(markup, /神石高原町/);
  assert.match(mealsMarkup, /0〜2歳児は給食費が保育料に含まれる扱いが基本/);
  assert.match(mealsMarkup, /第3子以降の副食費免除/);
  assert.match(
    mealsMarkup,
    /自治体独自の給食費支援は確認できず。基本的な副食費・免除条件は公式出典を参照/,
  );
  assert.doesNotMatch(
    markup,
    /childcare-status-cell childcare-status-cell--missing/,
  );
});

test("小学生以降は就学援助と学童保育を23市町に掲載する", async () => {
  const file = await childcare();
  const schoolSupport = file.programs.filter(
    ({ category }) => category === "school_support",
  );
  const specialNeedsSupport = file.programs.filter(
    ({ category }) => category === "special_needs_support",
  );
  const afterSchoolCare = file.programs.filter(
    ({ category }) => category === "after_school_care",
  );
  const learningSupport = file.programs.filter(
    ({ category }) => category === "learning_support",
  );
  assert.equal(schoolSupport.length, 23);
  assert.equal(specialNeedsSupport.length, 23);
  assert.equal(afterSchoolCare.length, 23);
  assert.equal(learningSupport.length, 22);
  for (const municipalityCode of [
    "34100",
    "34202",
    "34204",
    "34205",
    "34207",
    "34209",
    "34212",
    "34214",
    "34215",
    "34302",
    "34304",
    "34307",
    "34309",
    "34369",
  ]) {
    assert.ok(
      learningSupport.some(
        (program) => program.municipalityCode === municipalityCode,
      ),
      `学習生活支援の掲載がありません: ${municipalityCode}`,
    );
  }
  assert.equal(
    new Set(schoolSupport.map(({ municipalityCode }) => municipalityCode)).size,
    23,
  );
  assert.equal(
    new Set(schoolSupport.map(({ sourceUrl }) => sourceUrl)).size,
    23,
  );
  assert.equal(
    new Set(afterSchoolCare.map(({ municipalityCode }) => municipalityCode))
      .size,
    23,
  );
  assert.equal(
    new Set(specialNeedsSupport.map(({ municipalityCode }) => municipalityCode))
      .size,
    23,
  );
  assert.equal(
    file.programs.find(({ id }) => id === "hiroshima-school-support")
      ?.sourceUrl,
    "https://www.city.hiroshima.lg.jp/education/shugaku/1026074/1046993.html",
  );
  assert.match(
    file.programs.find(({ id }) => id === "hiroshima-school-support")
      ?.summary ?? "",
    /新入学用品費.*修学旅行費/,
  );
  assert.equal(
    file.programs.find(({ id }) => id === "fukuyama-school-support")?.sourceUrl,
    "https://www.city.fukuyama.hiroshima.jp/uploaded/life/386438_2364256_misc.pdf",
  );
  assert.equal(
    file.programs.find(({ id }) => id === "kure-school-support")?.sourceUrl,
    "https://www.city.kure.lg.jp/soshiki/64/r5-syugakuenjo1.html",
  );
  assert.match(
    file.programs.find(({ id }) => id === "higashihiroshima-school-support")
      ?.summary ?? "",
    /2026年度は小学校給食費が無償化/,
  );
  assert.match(
    afterSchoolCare.find(({ id }) => id === "hiroshima-after-school-care")
      ?.summary ?? "",
    /月3,000円.*月5,000円.*第2子は半額.*第3子以降は無料/,
  );
  assert.match(
    afterSchoolCare.find(({ id }) => id === "fukuyama-after-school-care")
      ?.summary ?? "",
    /小学1〜6年生.*18時.*月額3,000円.*2人目以降は月1,500円/,
  );
  assert.match(
    afterSchoolCare.find(({ id }) => id === "kumano-after-school-care")
      ?.summary ?? "",
    /月額3,000円.*夏・冬の冷暖房費.*各月1,000円.*第2子は半額.*第3子以降は無料/,
  );
  assert.match(
    afterSchoolCare.find(({ id }) => id === "fuchucho-after-school-care")
      ?.summary ?? "",
    /2026年6月.*月額3,000円.*月額2,000円.*月額5,000円/,
  );
  assert.match(
    afterSchoolCare.find(({ id }) => id === "hatsukaichi-after-school-care")
      ?.summary ?? "",
    /月額3,000円.*延長利用は月額3,600円/,
  );
  assert.match(
    afterSchoolCare.find(({ id }) => id === "otake-after-school-care")?.notes ??
      "",
    /夏休みのみ利用可.*春休み・冬休みのみの募集はなし.*おやつ代.*傷害保険料/,
  );
  const markup = renderToStaticMarkup(
    ChildcareDashboard({ data: file, selectedCategory: "school_support" }),
  );
  assert.match(markup, /就学援助・学用品費/);
  assert.match(markup, /対象・申請・援助内容/);
  assert.match(markup, /対象所得/);
  assert.match(markup, /学用品費・給食費等/);
  assert.doesNotMatch(
    markup,
    /childcare-status-cell childcare-status-cell--missing/,
  );
  const specialNeedsMarkup = renderToStaticMarkup(
    ChildcareDashboard({
      data: file,
      selectedCategory: "special_needs_support",
    }),
  );
  assert.match(specialNeedsMarkup, /特別支援教育就学奨励費/);
  assert.match(
    specialNeedsMarkup,
    /市町立学校等の特別支援学級、一定の障害程度に該当する通常学級等/,
  );
  assert.match(
    specialNeedsMarkup,
    /県立特別支援学校の就学奨励費は広島県の制度/,
  );
  assert.match(specialNeedsMarkup, /23市町/);
  assert.match(
    specialNeedsMarkup,
    /通常の就学援助を受給する場合は重複受給できません/,
  );
  assert.match(
    specialNeedsSupport.find(
      ({ id }) => id === "hiroshima-special-needs-support",
    )?.summary ?? "",
    /学用品費（小5,820円・中11,370円）.*新入学学用品・通学用品費（小28,530円・中31,500円）/,
  );
  assert.match(
    specialNeedsSupport.find(
      ({ id }) => id === "higashihiroshima-special-needs-support",
    )?.notes ?? "",
    /小学校給食費は無償化により支給対象外.*毎年6月頃に学校から案内/,
  );
  assert.match(
    specialNeedsSupport.find(
      ({ id }) => id === "fukuyama-special-needs-support",
    )?.summary ?? "",
    /1.5倍未満.*1.5倍以上2.5倍未満.*体育実技用具費.*拡大教材費/,
  );
  assert.match(
    specialNeedsSupport.find(({ id }) => id === "miyoshi-special-needs-support")
      ?.summary ?? "",
    /小・中学校の特別支援学級.*校外活動費/,
  );
  for (const program of specialNeedsSupport) {
    assert.doesNotMatch(program.summary, /特別支援学校/);
    assert.doesNotMatch(program.notes ?? "", /県立特別支援学校/);
  }
  const afterSchoolMarkup = renderToStaticMarkup(
    ChildcareDashboard({ data: file, selectedCategory: "after_school_care" }),
  );
  assert.match(afterSchoolMarkup, /23市町/);
  assert.match(afterSchoolMarkup, /利用条件・時間・費用/);
  assert.match(afterSchoolMarkup, /おやつ・保険料等/);
  const learningSupportMarkup = renderToStaticMarkup(
    ChildcareDashboard({ data: file, selectedCategory: "learning_support" }),
  );
  assert.match(learningSupportMarkup, /子どもの居場所・学習生活支援/);
  assert.match(learningSupportMarkup, /生活困窮・ひとり親世帯向け/);
  assert.match(learningSupportMarkup, /不登校・学校外の教育支援センター/);
  assert.match(learningSupportMarkup, /対象・支援内容・利用料/);
  assert.match(
    learningSupportMarkup,
    /掲載のない市町は制度がないとは限りません/,
  );
  assert.match(
    learningSupport.find(({ id }) => id === "onomichi-learning-support")
      ?.summary ?? "",
    /安心して過ごせる場.*生活習慣.*学習.*進路相談/,
  );
  assert.match(
    learningSupport.find(({ id }) => id === "fukuyama-learning-support")
      ?.summary ?? "",
    /中学生180人・高校生130人.*オンライン学習を週2回・各150分.*会場学習を月1回・120分/,
  );
  assert.match(
    learningSupport.find(({ id }) => id === "mihara-learning-support")
      ?.summary ?? "",
    /小学4年生から中学3年生.*少人数制の個別指導.*オンライン参加/,
  );
  assert.match(
    learningSupport.find(
      ({ id }) => id === "kure-education-advancement-support",
    )?.summary ?? "",
    /ひとり親家庭の中学1〜3年生/,
  );
  assert.match(
    learningSupport.find(({ id }) => id === "hiroshima-fureai-class")
      ?.subcategory ?? "",
    /不登校・学校外の教育支援センター/,
  );
  assert.match(
    learningSupport.find(
      ({ id }) => id === "etajima-prefectural-single-parent-support",
    )?.notes ?? "",
    /市町独自制度ではなく県事業/,
  );
});

test("その他は主な独自・特記事項を公式出典付きで表示する", async () => {
  const file = await childcare();
  const otherPrograms = file.programs.filter(
    ({ category }) => category === "other",
  );
  assert.equal(otherPrograms.length, 7);
  assert.deepEqual(
    new Set(otherPrograms.map(({ municipalityCode }) => municipalityCode)),
    new Set(["34205", "34207", "34210", "34213", "34307", "34369"]),
  );
  const diaper = otherPrograms.find(
    ({ id }) => id === "hatsukaichi-baby-diaper",
  );
  assert.match(diaper?.summary ?? "", /生後3・6・9か月、1歳.*計4回/);
  assert.match(
    diaper?.notes ?? "",
    /事前予約制.*メーカー・銘柄は選べず.*子育て相談/,
  );
  assert.match(
    otherPrograms.find(({ id }) => id === "shobara-geibi-commuter-pass")
      ?.summary ?? "",
    /6か月定期は30％.*3か月定期は20％.*1か月定期は10％/,
  );
  assert.match(
    otherPrograms.find(({ id }) => id === "kumano-housing-support")?.summary ??
      "",
    /住宅取得・定住を支援/,
  );
  const markup = renderToStaticMarkup(
    ChildcareDashboard({ data: file, selectedCategory: "other" }),
  );
  assert.match(markup, /その他の制度比較/);
  assert.match(markup, /住宅・定住、通学費/);
  assert.match(markup, /主な独自・特記事項/);
  assert.match(markup, /あかちゃんオムツプレゼント事業/);
  assert.match(markup, /未掲載は制度なしを意味しません/);
});

test("子ども医療は23市町の公式制度と改正後の適用時期を表示する", async () => {
  const file = await childcare();
  const markup = renderToStaticMarkup(
    ChildcareDashboard({ data: file, selectedCategory: "medical" }),
  );
  assert.match(markup, /2027年1月診療分から（拡充後）/);
  assert.match(markup, /医療機関ごとに1日500円/);
  assert.match(markup, /申請・対象外等/);
  const hiroshimaFuture = file.measures.find(
    ({ id }) => id === "hiroshima-child-medical-future",
  );
  assert.ok(hiroshimaFuture);
  assert.match(hiroshimaFuture.userCost ?? "", /初診・再診とも1日1,500円/);
  assert.ok(
    !(hiroshimaFuture.userCost ?? "").includes(
      "小学生〜高校生年代の第1・2子が再診無料",
    ),
  );
  assert.match(hiroshimaFuture.conditions ?? "", /申請が必要/);
  assert.match(hiroshimaFuture.notes ?? "", /生活保護/);
  const saka = file.measures.find(
    ({ id }) => id === "saka-child-medical-measure",
  );
  assert.equal(
    saka?.userCost,
    "課税世帯：通院1日500円（月4日まで）、入院1日500円（月14日まで）／非課税世帯：無料",
  );
  const fukuyamaFuture = file.measures.find(
    ({ id }) => id === "fukuyama-child-medical-future",
  );
  assert.match(fukuyamaFuture?.conditions ?? "", /申請が必要/);
  for (const name of [
    "呉市",
    "竹原市",
    "三原市",
    "尾道市",
    "三次市",
    "庄原市",
    "福山市",
    "廿日市市",
    "海田町",
    "安芸太田町",
    "北広島町",
    "世羅町",
    "神石高原町",
  ]) {
    assert.match(markup, new RegExp(name));
  }
});

test("自治体詳細は制度の基準日と公式リンクを表示する", async () => {
  const file = await childcare();
  const municipality = file.municipalities.find(
    ({ municipalityCode }) => municipalityCode === "34214",
  );
  assert.ok(municipality);
  const programs = file.programs.filter(
    ({ municipalityCode }) => municipalityCode === "34214",
  );
  const measures = file.measures.filter(
    ({ municipalityCode }) => municipalityCode === "34214",
  );
  const markup = renderToStaticMarkup(
    ChildcareDetailPanel({ municipality, programs, measures }),
  );
  assert.match(markup, /18歳以下の兄弟姉妹/);
  assert.match(markup, /2026年10月3日時点/);
  assert.match(markup, /https:\/\/www\.akitakata\.jp/);
});

test("自治体詳細は制度改正の適用期間を区別して表示する", async () => {
  const file = await childcare();
  const municipality = file.municipalities.find(
    ({ municipalityCode }) => municipalityCode === "34302",
  );
  assert.ok(municipality);
  const programs = file.programs.filter(
    ({ municipalityCode }) => municipalityCode === "34302",
  );
  const measures = file.measures.filter(
    ({ municipalityCode }) => municipalityCode === "34302",
  );
  const markup = renderToStaticMarkup(
    ChildcareDetailPanel({ municipality, programs, measures }),
  );
  assert.match(markup, /2027年1月1日から（拡充後）/);
  assert.match(markup, /適用期間：2027年1月1日時点〜現在/);
});
