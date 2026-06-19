// 渋沢栄一杯 経済史経営史ディベート大会 ルールに基づく試合構成（簡略版）
// 立論は肯定側がファイルでアップロードし、否定側の立論はAIが内部資料として生成する（読み上げはしない）。
// 反駁・最終弁論は省略。反対尋問は否定側→肯定側の一方向のみ。フリーディスカッションは実施する。
export const PHASES = [
  {
    key: "cross",
    label: "①反対尋問",
    kind: "cross",
    order: ["negative"], // 否定側のみが質問者（肯定側に対して尋問）
    minutesEach: 5,
  },
  { key: "break1", label: "休憩", kind: "break", minutes: 3 },
  {
    key: "free",
    label: "②フリーディスカッション",
    kind: "free",
    // 否定側が質問主導で開始、10分後に肯定側主導に交替、計20分
    halves: [
      { lead: "negative", minutes: 10 },
      { lead: "affirmative", minutes: 10 },
    ],
  },
];

export const SCORING_RUBRIC = [
  { key: "opening", label: "立論（提出資料の内容）", max: 13 },
  { key: "cross", label: "反対尋問", max: 3 },
  { key: "free", label: "フリーディスカッション", max: 10 },
  { key: "originality", label: "独創性", max: 2 },
  { key: "teamwork", label: "チームワーク", max: 3 },
  { key: "overall", label: "総合力", max: 3 },
];

export const SCORING_TOTAL = SCORING_RUBRIC.reduce((s, r) => s + r.max, 0); // 45

export const SIDE_LABEL = { affirmative: "肯定側", negative: "否定側" };
