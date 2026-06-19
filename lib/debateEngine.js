import { PHASES, SIDE_LABEL, SCORING_RUBRIC } from "./rules.js";
import { generateText } from "./geminiClient.js";
import { buildContentBlocks, fileNames } from "./fileBlocks.js";

function sideSystemPrompt(side, topic) {
  const stance = side === "affirmative" ? "肯定" : "否定";
  return `あなたは大学ディベート大会「渋沢栄一杯」に出場している${stance}側チームです。
論題は「${topic}」です。
あなたは${stance}側の立場で、論理的かつ具体的なデータ・根拠を用いて議論してください。
日本語で、ディベートの場にふさわしい説得力のある話し方をしてください。
発言は地の文のみで、speaker名や記号などのメタ情報は出力しないでください。
肯定側の立論資料は添付されたファイル（PDF等）そのものを参照してください。`;
}

function transcriptAsContext(transcript) {
  if (transcript.length === 0) return "（まだ発言はありません）";
  return transcript
    .map((t) => `[${t.phaseLabel} / ${SIDE_LABEL[t.side] ?? t.side}]\n${t.text}`)
    .join("\n\n");
}

async function speak({ side, topic, phaseLabel, instruction, transcript, openingBlocks }) {
  const system = sideSystemPrompt(side, topic);
  const context = transcriptAsContext(transcript);
  const parts = [
    ...openingBlocks,
    {
      text: `（上記は肯定側の立論資料の添付ファイルです）\n\nこれまでの試合の経過:\n${context}\n\n---\n今あなたが行うパート: ${phaseLabel}\n指示: ${instruction}`,
    },
  ];
  const text = await generateText({
    system,
    parts,
    maxTokens: 1400,
  });
  return text.trim();
}

async function dialogue({ questioner, answerer, topic, phaseLabel, instruction, transcript, exchanges, openingBlocks }) {
  const system = `あなたは大学ディベート大会「渋沢栄一杯」の進行を記録する書記です。
論題は「${topic}」です。
${SIDE_LABEL[questioner]}が質問者、${SIDE_LABEL[answerer]}が回答者となる、${phaseLabel}の一問一答の書き起こしを作成してください。
出力形式は厳密に以下のみを${exchanges}往復分繰り返してください（往復=質問1回+回答1回）。
質問: <質問内容>
回答: <回答内容>
他の説明・前置き・後書きは一切出力しないこと。
肯定側の立論資料は添付されたファイル（PDF等）そのものを参照してください。`;
  const context = transcriptAsContext(transcript);
  const parts = [
    ...openingBlocks,
    {
      text: `（上記は肯定側の立論資料の添付ファイルです）\n\nこれまでの試合の経過:\n${context}\n\n---\n指示: ${instruction}`,
    },
  ];
  const text = await generateText({
    system,
    parts,
    maxTokens: 1800,
  });
  return text.trim();
}

// フェーズの所要時間(分)を、デモ用に短縮した「想定読み上げ秒数」に変換する目的の概算
function estimateSeconds(minutes) {
  return Math.max(8, Math.round(minutes * 6)); // 6秒/分相当のデモ用タイミング
}

export async function* runDebate({ topic, affirmativeFiles }) {
  const transcript = [];
  const openingBlocks = buildContentBlocks(affirmativeFiles);

  // 肯定側の立論はテキスト抽出せず、添付ファイルそのものを毎回のAI呼び出しに同梱して参照する
  transcript.push({
    phaseKey: "opening",
    phaseLabel: "立論（提出資料）",
    side: "affirmative",
    text: "（添付ファイルを直接参照。本文はテキスト化していません）",
  });
  yield {
    type: "document",
    phaseKey: "opening",
    phaseLabel: "立論（提出資料）",
    side: "affirmative",
    files: fileNames(affirmativeFiles),
  };

  // 否定側の立論はAIが内部資料として生成する（読み上げフェーズとしては表示しない）
  const negativeOpening = await speak({
    side: "negative",
    topic,
    phaseLabel: "立論（内部資料）",
    instruction:
      "添付された肯定側の立論資料の内容を踏まえ、否定側としての立論の骨子（主張・論点・根拠）を資料としてまとめてください。これは読み上げ原稿ではなく、後の反対尋問・フリーディスカッションで使う内部資料です。",
    transcript,
    openingBlocks,
  });
  transcript.push({
    phaseKey: "opening",
    phaseLabel: "立論（内部資料）",
    side: "negative",
    text: negativeOpening,
  });
  yield {
    type: "document",
    phaseKey: "opening",
    phaseLabel: "立論（内部資料・否定側）",
    side: "negative",
    text: negativeOpening,
  };

  for (const phase of PHASES) {
    if (phase.kind === "break") {
      yield { type: "break", label: phase.label, minutes: phase.minutes, seconds: estimateSeconds(phase.minutes) };
      continue;
    }

    yield { type: "phase_start", key: phase.key, label: phase.label };

    if (phase.kind === "cross") {
      for (const questioner of phase.order) {
        const answerer = questioner === "affirmative" ? "negative" : "affirmative";
        const text = await dialogue({
          questioner,
          answerer,
          topic,
          phaseLabel: phase.label,
          instruction: "Yes/Noもしくは短く答えられる質問を中心に、テンポの良い尋問を行ってください。",
          transcript,
          exchanges: 4,
          openingBlocks,
        });
        const entry = {
          phaseKey: phase.key,
          phaseLabel: phase.label,
          side: questioner,
          questioner,
          answerer,
          text,
        };
        transcript.push(entry);
        yield {
          type: "dialogue",
          ...entry,
          minutes: phase.minutesEach,
          seconds: estimateSeconds(phase.minutesEach),
        };
      }
    }

    if (phase.kind === "free") {
      for (const half of phase.halves) {
        const other = half.lead === "affirmative" ? "negative" : "affirmative";
        const text = await dialogue({
          questioner: half.lead,
          answerer: other,
          topic,
          phaseLabel: `${phase.label}（${SIDE_LABEL[half.lead]}主導）`,
          instruction: "自由な討論形式で、相手への質問と反論を織り交ぜながら議論を深めてください。",
          transcript,
          exchanges: 6,
          openingBlocks,
        });
        const entry = {
          phaseKey: phase.key,
          phaseLabel: `${phase.label}（${SIDE_LABEL[half.lead]}主導）`,
          side: half.lead,
          questioner: half.lead,
          answerer: other,
          text,
        };
        transcript.push(entry);
        yield {
          type: "dialogue",
          ...entry,
          minutes: half.minutes,
          seconds: estimateSeconds(half.minutes),
        };
      }
    }

    yield { type: "phase_end", key: phase.key, label: phase.label };
  }

  yield { type: "judging_start" };
  const judgment = await judge({ topic, transcript, openingBlocks });
  yield { type: "judgment", ...judgment };
}

async function judge({ topic, transcript, openingBlocks }) {
  const system = `あなたは「渋沢栄一杯経済史経営史ディベート大会」のジャッジです。
以下の採点基準（計34点）に従い、肯定側・否定側それぞれを公平に採点してください。
肯定側の立論資料は添付されたファイル（PDF等）そのものを参照してください。
採点項目: ${SCORING_RUBRIC.map((r) => `${r.label}(${r.max}点)`).join("、")}
必ず以下のJSON形式のみで出力してください（説明文・コードブロック記号は不要）:
{
  "affirmative": { "scores": {"opening":0,"cross":0,"free":0,"originality":0,"teamwork":0,"overall":0}, "total":0, "comment":"総評" },
  "negative": { "scores": {"opening":0,"cross":0,"free":0,"originality":0,"teamwork":0,"overall":0}, "total":0, "comment":"総評" },
  "winner": "affirmative または negative",
  "summary": "試合全体の総括コメント"
}`;
  const parts = [
    ...openingBlocks,
    {
      text: `（上記は肯定側の立論資料の添付ファイルです）\n\n論題: ${topic}\n\n試合の書き起こし全文:\n${transcriptAsContext(transcript)}`,
    },
  ];
  const raw = await generateText({
    system,
    parts,
    maxTokens: 1500,
  });
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    return { raw, parseError: true };
  }
}
