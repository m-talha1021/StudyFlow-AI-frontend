// ============================================================
// AI DETECTOR (Round 72) — pure, dependency-free helpers.
// Rebuilt from the Round 70 Plagiarism Checker: the check no
// longer compares against the user's saved library. It scores a
// document on statistical signals of AI-written text and returns
// an AI-likelihood percentage (0-100) + a verdict. No backend,
// no quota, no AI call, no corpus, no internet.
//
// HONESTY: this is a statistical estimate, not a certainty.
// Short texts (<50 words) are flagged low-confidence in the
// report, and the UI must say the result is an estimate.
//
// SIGNAL WEIGHTS (sum to 1.00 — tuned on the Round 72 unit
// tests, see ~/workspace/csscheck/round72-ai-detector.test.mjs):
//   burstiness (sentence-length uniformity) .... 0.30
//   perplexity proxy (common-word share) ........ 0.10
//   vocabulary diversity (MATTR-50) ............ 0.15
//   AI marker phrases .......................... 0.20
//   formulaic sentence starts .................. 0.15
//   repeated 5-gram rate ....................... 0.10
// Perplexity carries little weight on purpose: on short
// student texts the common-word share barely separates AI from
// human (topic nouns dominate both), while burstiness, marker
// phrases and transition-word starts separate them clearly.
// Verdict bands: >= 70 "Likely AI-written",
// 40-69 "Mixed / uncertain", < 40 "Likely human-written".
//
// The filename stays plagiarism.js (and the import in App.jsx)
// so the Round 70 snapshot history keeps working; the engine
// inside is the AI detector now. Old saved plagiarism reports
// (kind "plagiarism" in generatedHistory) still open via the
// legacy branch in App.jsx — see aiDetectionReportAsText.
// ============================================================

// Lowercase, strip punctuation, collapse whitespace.
export function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Split into sentences on . ! ? and newlines; drop empties.
export function splitSentences(text) {
  return String(text || "")
    .split(/[\n.!?]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

// Normalized words of one sentence.
export function sentenceWords(sentence) {
  const normalized = normalizeText(sentence);
  return normalized ? normalized.split(" ") : [];
}

// All words of a document, in order.
export function documentWords(text) {
  const normalized = normalizeText(text);
  return normalized ? normalized.split(" ") : [];
}

// ------------------------------------------------------------
// Signal 1 — burstiness: coefficient of variation (std / mean)
// of sentence lengths in words. AI text is unnaturally uniform
// (low CV); human writing bursts (high CV).
// Returns an AI score 0..1: CV <= 0.15 -> 1, CV >= 0.55 -> 0.
// ------------------------------------------------------------
export function burstinessScore(sentenceLengths) {
  const lengths = (sentenceLengths || []).filter((n) => n > 0);
  if (lengths.length < 2) return 0.5;
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (mean === 0) return 0.5;
  const variance =
    lengths.reduce((sum, n) => sum + (n - mean) * (n - mean), 0) /
    lengths.length;
  const cv = Math.sqrt(variance) / mean;
  if (cv <= 0.15) return 1;
  if (cv >= 0.55) return 0;
  return (0.55 - cv) / 0.4;
}

// ------------------------------------------------------------
// Signal 2 — perplexity proxy: share of words that sit in the
// ~220 most common English words. AI text leans on common,
// highly predictable words (high share); human text uses rarer
// words (low share). A raw average-surprisal score drowns in
// out-of-list words, so the share is the discriminating value.
// Returns an AI score 0..1: share >= 0.80 -> 1, <= 0.60 -> 0.
// ------------------------------------------------------------
export const FREQUENT_WORDS = (
  "the of and a to in is you that it he was for on are as with his they i " +
  "at be this have from or one had by word but not what all were we when " +
  "your can said there use an each which she do how their if will up other " +
  "about out many then them these so some her would make like him into time " +
  "has look two more write go see number no way could people my than first " +
  "water been call who oil its now find long down day did get come made may " +
  "part over new sound take only little work know place year live me back " +
  "give most very after thing our just name good sentence man think say " +
  "great where help through much before line right too mean old any same " +
  "tell boy follow came want show also around form three small set put end " +
  "does another well large must big even such because turn here why ask went " +
  "men read need land different home us move try kind hand picture again " +
  "change off play spell air away animal house point page letter mother " +
  "answer found study still learn should world high every near add food " +
  "between own below country plant last school father keep tree never start " +
  "city earth eye light thought head under story saw left few while along " +
  "might close something seem next hard open example begin life always " +
  "those both paper together got group often run"
).split(" ");

// Surprisal of a word: -ln(p), with p ~ 0.055 / (rank + 1) ^ 0.85
// for listed words (rank 0 = "the") and p = 0.00008 out of list.
export function wordSurprisal(word) {
  const rank = FREQUENT_WORDS.indexOf(word);
  if (rank === -1) return -Math.log(0.00008);
  return -Math.log(0.055 / Math.pow(rank + 1, 0.85));
}

export function perplexityScore(words) {
  if (!words || words.length === 0) return 0.5;
  let inList = 0;
  for (const word of words) {
    if (FREQUENT_WORDS.indexOf(word) !== -1) inList += 1;
  }
  const share = inList / words.length;
  if (share >= 0.8) return 1;
  if (share <= 0.6) return 0;
  return (share - 0.6) / 0.2;
}

// ------------------------------------------------------------
// Signal 3 — vocabulary diversity: moving-average type-token
// ratio over 50-word windows (MATTR-50, length-stable unlike
// raw TTR). AI text repeats a narrower vocabulary (low MATTR).
// Returns an AI score 0..1: MATTR <= 0.72 -> 1, >= 0.84 -> 0.
// ------------------------------------------------------------
export function mattrScore(words, windowSize = 50) {
  if (!words || words.length < 10) return 0.5;
  const windows = [];
  if (words.length <= windowSize) {
    windows.push(words);
  } else {
    for (let i = 0; i <= words.length - windowSize; i += 1) {
      windows.push(words.slice(i, i + windowSize));
    }
  }
  const ttrs = windows.map(
    (window) => new Set(window).size / window.length
  );
  const mattr = ttrs.reduce((a, b) => a + b, 0) / ttrs.length;
  if (mattr <= 0.72) return 1;
  if (mattr >= 0.84) return 0;
  return (0.84 - mattr) / 0.12;
}

// ------------------------------------------------------------
// Signal 4 — AI marker phrases: stock phrases LLMs lean on.
// Density = hits per 1000 words. Returns an AI score 0..1:
// 0 hits -> 0, >= 50 hits/1000 words -> 1 (linear between).
// ------------------------------------------------------------
export const AI_MARKER_PHRASES = [
  "as an ai language model",
  "as an ai",
  "in today's fast-paced world",
  "in today's world",
  "it is important to note",
  "it is worth noting",
  "furthermore",
  "moreover",
  "in conclusion",
  "in summary",
  "additionally",
  "delve",
  "tapestry",
  "landscape",
  "crucial",
  "pivotal",
  "paramount",
  "moreover,",
  "in addition",
  "on the other hand",
  "a testament to",
  "plays a crucial role",
  "plays an important role",
  "in the realm of",
  "navigate the complexities",
  "ever-evolving",
  "cutting-edge",
  "seamlessly",
  "foster",
  "underscore",
  "meticulous",
];

export function markerScore(normalizedText, wordCount) {
  if (!normalizedText || !wordCount) return 0;
  const text = ` ${normalizedText} `;
  let hits = 0;
  for (const phrase of AI_MARKER_PHRASES) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(` ${phrase} `, from);
      if (at === -1) break;
      hits += 1;
      from = at + 1;
    }
  }
  const density = (1000 * hits) / wordCount;
  if (density <= 0) return 0;
  if (density >= 100) return 1;
  return density / 100;
}

// ------------------------------------------------------------
// Signal 5 — formulaic sentence starts: share of sentences
// that open with a transition word/phrase (Furthermore,
// Moreover, Additionally, In conclusion, ...). AI text opens
// sentence after sentence with one of these; human writing
// starts sentences in far more varied ways. (A same-first-word
// share was tried first and barely separated the two — the
// transition-word share does.)
// Returns an AI score 0..1: share 0 -> 0, >= 0.60 -> 1.
// ------------------------------------------------------------
export const TRANSITION_STARTS = [
  "furthermore",
  "moreover",
  "additionally",
  "however",
  "therefore",
  "thus",
  "firstly",
  "secondly",
  "thirdly",
  "finally",
  "overall",
  "consequently",
  "nevertheless",
  "nonetheless",
  "meanwhile",
  "subsequently",
  "ultimately",
  "notably",
  "importantly",
  "significantly",
  "in addition",
  "in conclusion",
  "in summary",
  "in contrast",
  "in particular",
  "in fact",
  "in other words",
  "on the other hand",
  "as a result",
  "for example",
  "for instance",
];

export function initialWordScore(sentences) {
  const list = (sentences || []).filter(
    (sentence) => sentenceWords(sentence).length >= 2
  );
  if (list.length < 2) return 0.5;
  let transitionStarts = 0;
  for (const sentence of list) {
    const normalized = normalizeText(sentence);
    if (
      TRANSITION_STARTS.some(
        (phrase) =>
          normalized === phrase || normalized.startsWith(`${phrase} `)
      )
    ) {
      transitionStarts += 1;
    }
  }
  const share = transitionStarts / list.length;
  if (share <= 0) return 0;
  if (share >= 0.6) return 1;
  return share / 0.6;
}

// ------------------------------------------------------------
// Signal 6 — repeated 5-gram rate: share of 5-word windows
// that occur more than once (AI text reuses stock phrasing).
// Returns an AI score 0..1: 0 -> 0, >= 0.15 -> 1.
// ------------------------------------------------------------
export function repeatedNgramScore(words, n = 5) {
  if (!words || words.length < n * 2) return 0;
  const seen = new Set();
  const repeated = new Set();
  let total = 0;
  for (let i = 0; i <= words.length - n; i += 1) {
    const gram = words.slice(i, i + n).join(" ");
    total += 1;
    if (seen.has(gram)) repeated.add(gram);
    else seen.add(gram);
  }
  if (total === 0) return 0;
  const rate = repeated.size / total;
  if (rate <= 0) return 0;
  if (rate >= 0.15) return 1;
  return rate / 0.15;
}

// ------------------------------------------------------------
// Combined detector. Weights documented in the file header.
// Returns a report:
// { percentage, verdict, totalWords, totalSentences,
//   lowConfidence, emptyDocument, signals: [
//     { id, label, display, value (0..1 AI score),
//       points (weighted contribution, 0..weight*100) } ] }
// ------------------------------------------------------------
export const SIGNAL_WEIGHTS = {
  burstiness: 0.3,
  perplexity: 0.1,
  vocabulary: 0.15,
  markers: 0.2,
  initials: 0.15,
  repetition: 0.1,
};

export function verdictForPercentage(percentage) {
  if (percentage >= 70) return "Likely AI-written";
  if (percentage >= 40) return "Mixed / uncertain";
  return "Likely human-written";
}

export function detectAIText(documentText) {
  const text = String(documentText || "");
  const sentences = splitSentences(text);
  const words = documentWords(text);
  const normalized = normalizeText(text);
  const emptyDocument = !text.trim();

  // No words at all: a 0% report with zeroed signals (the UI
  // shows the "paste or upload" notice instead of running).
  if (words.length === 0) {
    return {
      percentage: 0,
      verdict: "Likely human-written",
      totalWords: 0,
      totalSentences: 0,
      lowConfidence: true,
      emptyDocument: true,
      signals: Object.keys(SIGNAL_WEIGHTS).map((id) => ({
        id,
        label: id,
        display: "No text to analyse.",
        value: 0,
        points: 0,
      })),
    };
  }

  const sentenceLengths = sentences.map(
    (sentence) => sentenceWords(sentence).length
  );
  const eligibleSentences = sentences.filter(
    (sentence) => sentenceWords(sentence).length >= 2
  );

  const scores = {
    burstiness: burstinessScore(sentenceLengths),
    perplexity: perplexityScore(words),
    vocabulary: mattrScore(words),
    markers: markerScore(normalized, words.length),
    initials: initialWordScore(eligibleSentences),
    repetition: repeatedNgramScore(words),
  };

  const labels = {
    burstiness: "Sentence-length variety",
    perplexity: "Word predictability",
    vocabulary: "Vocabulary diversity",
    markers: "AI-style phrases",
    initials: "Formulaic sentence starts",
    repetition: "Repeated phrasing",
  };
  const transitionStartCount = (() => {
    let count = 0;
    for (const sentence of eligibleSentences) {
      const normalized = normalizeText(sentence);
      if (
        TRANSITION_STARTS.some(
          (phrase) =>
            normalized === phrase || normalized.startsWith(`${phrase} `)
        )
      ) {
        count += 1;
      }
    }
    return count;
  })();
  const markerHits = (() => {
    let hits = 0;
    const padded = ` ${normalized} `;
    for (const phrase of AI_MARKER_PHRASES) {
      let from = 0;
      for (;;) {
        const at = padded.indexOf(` ${phrase} `, from);
        if (at === -1) break;
        hits += 1;
        from = at + 1;
      }
    }
    return hits;
  })();
  const avgSurprisal = words.length
    ? words.reduce((sum, word) => sum + wordSurprisal(word), 0) / words.length
    : 0;
  const inListShare = words.length
    ? words.filter((word) => FREQUENT_WORDS.indexOf(word) !== -1).length /
      words.length
    : 0;
  const lengthRange =
    sentenceLengths.length > 0
      ? `${Math.min(...sentenceLengths)}–${Math.max(...sentenceLengths)} words`
      : "no sentences";

  const displays = {
    burstiness: `sentences run ${lengthRange} (uniform lengths look AI-written)`,
    perplexity: `${Math.round(100 * inListShare)}% of words are among the most common English words (avg surprisal ${avgSurprisal.toFixed(2)})`,
    vocabulary: `moving-average type-token ratio over 50-word windows`,
    markers: `${markerHits} stock AI phrase(s) found`,
    initials: `${transitionStartCount} of ${eligibleSentences.length} sentences start with a transition word`,
    repetition: `repeated 5-word phrases in the text`,
  };

  const signals = Object.keys(SIGNAL_WEIGHTS).map((id) => ({
    id,
    label: labels[id],
    display: displays[id],
    value: scores[id],
    points: Math.round(100 * SIGNAL_WEIGHTS[id] * scores[id] * 10) / 10,
  }));

  const percentage = Math.round(
    signals.reduce((sum, signal) => sum + signal.points, 0)
  );

  return {
    percentage: Math.max(0, Math.min(100, percentage)),
    verdict: verdictForPercentage(percentage),
    totalWords: words.length,
    totalSentences: sentences.length,
    lowConfidence: words.length < 50 || sentences.length < 3,
    emptyDocument,
    signals,
  };
}

// Plain-text summary of a report (history PDF download / sharing).
// Handles BOTH shapes: the new AI-detector report (signals) and a
// legacy Round 70 plagiarism report (sources/matches) so saved
// plagiarism reports still export correctly.
export function aiDetectionReportAsText(report) {
  if (!report) return "";
  if (Array.isArray(report.signals)) {
    const lines = [
      `AI Detector: ${report.percentage}% AI likelihood — ${report.verdict}.`,
      `${report.totalWords || 0} words, ${report.totalSentences || 0} sentences.`,
      "A statistical estimate, not a certainty — short texts are less reliable.",
    ];
    for (const signal of report.signals) {
      lines.push(`- ${signal.label}: ${signal.display} (${signal.points} pts)`);
    }
    return lines.join("\n");
  }
  // Legacy plagiarism report (Round 70 shape).
  if (typeof report.percentage !== "number") return "";
  const lines = [
    `Plagiarism check (saved before the AI detector update): ${report.percentage}% similarity.`,
    `Checked against ${report.checkedItems || 0} saved items in your StudyQue library (your own saved materials only — not the internet).`,
    `${report.matchedSentences || 0} of ${report.totalSentences || 0} sentences matched a saved item.`,
  ];
  if (Array.isArray(report.sources) && report.sources.length) {
    lines.push("Matched sources:");
    for (const source of report.sources) {
      lines.push(
        `- ${source.title}: ${source.matchedCount} sentence(s), ${source.percent}% of the document.`
      );
    }
  }
  if (Array.isArray(report.matches) && report.matches.length) {
    lines.push("Matched sentences:");
    for (const match of report.matches) {
      lines.push(`- "${match.sentence}" (source: ${match.sourceTitle})`);
    }
  }
  return lines.join("\n");
}

// ------------------------------------------------------------
// Daily limit (Round 72, Task G): 2 AI Detector checks per day.
// Client-side only — the detector runs locally, so the counter
// lives in localStorage, keyed by the local calendar date. The
// count resets when the stored date is not today (midnight
// local time). Each run on non-empty material consumes 1 check;
// re-checking the same document counts again (no dedup).
// ------------------------------------------------------------
export const AI_DETECTOR_DAILY_LIMIT = 2;
export const AI_DETECTOR_USAGE_KEY = "sq-ai-detector-usage";

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function readAIDetectorUsage(storage) {
  const store =
    storage ||
    (typeof localStorage !== "undefined" ? localStorage : null);
  if (!store) return { date: localDateString(), count: 0 };
  try {
    const raw = store.getItem(AI_DETECTOR_USAGE_KEY);
    if (!raw) return { date: localDateString(), count: 0 };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.count !== "number") {
      return { date: localDateString(), count: 0 };
    }
    if (parsed.date !== localDateString()) {
      return { date: localDateString(), count: 0 };
    }
    return { date: parsed.date, count: parsed.count };
  } catch (error) {
    return { date: localDateString(), count: 0 };
  }
}

export function remainingAIDetectorChecks(storage) {
  const usage = readAIDetectorUsage(storage);
  return Math.max(0, AI_DETECTOR_DAILY_LIMIT - usage.count);
}

export function recordAIDetectorCheck(storage) {
  const store =
    storage ||
    (typeof localStorage !== "undefined" ? localStorage : null);
  const usage = readAIDetectorUsage(store);
  const next = {
    date: localDateString(),
    count: usage.count + 1,
  };
  if (store) {
    try {
      store.setItem(AI_DETECTOR_USAGE_KEY, JSON.stringify(next));
    } catch (error) {
      // Storage full / unavailable: the check still ran; the
      // counter simply cannot persist.
    }
  }
  return next;
}
