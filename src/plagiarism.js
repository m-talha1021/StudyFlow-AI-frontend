// ============================================================
// PLAGIARISM CHECKER (Round 70) — pure, dependency-free helpers.
// The check compares a document ONLY against the user's own saved
// StudyFlow library (generated history + flashcard history).
// It never touches the internet, Turnitin or any academic
// database, and the UI must say so. A 0% result is legitimate.
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

// Set of n-word shingles (joined word windows) for a word list.
export function wordShingles(words, size = 8) {
  const shingles = new Set();
  if (!Array.isArray(words) || words.length < size) return shingles;
  for (let i = 0; i <= words.length - size; i += 1) {
    shingles.add(words.slice(i, i + size).join(" "));
  }
  return shingles;
}

// Jaccard similarity of two word Sets (0..1).
export function jaccardWords(setA, setB) {
  if (!setA || !setB || setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection += 1;
  }
  return intersection / (setA.size + setB.size - intersection);
}

// Sentence-level match against one prepared library source.
// Returns { sharedShingles, bestJaccard, verbatimShort }.
function matchSentenceAgainstSource(words, wordSet, shingles, normalizedSentence, source) {
  let sharedShingles = 0;
  for (const shingle of shingles) {
    if (source.shingles.has(shingle)) sharedShingles += 1;
  }

  let bestJaccard = 0;
  for (const sourceWords of source.sentenceWordSets) {
    const score = jaccardWords(wordSet, sourceWords);
    if (score > bestJaccard) bestJaccard = score;
  }

  const verbatimShort =
    words.length <= 7 &&
    normalizedSentence.length > 0 &&
    source.normalizedText.includes(normalizedSentence);

  return { sharedShingles, bestJaccard, verbatimShort };
}

// Compare a document against the user's saved library.
// libraryItems: [{ title, text }] — items with no usable text are
// skipped and NOT counted in checkedItems.
// Returns a report: { percentage, totalSentences, matchedSentences,
// checkedItems, shortDocument, emptyDocument, sources, matches }.
// percentage = share of the document's eligible sentences (4+ words)
// that match some library item. 0% is a real result, never faked up.
export function checkPlagiarism(documentText, libraryItems) {
  const sources = (Array.isArray(libraryItems) ? libraryItems : [])
    .map((item) => ({
      title: String(item?.title || "Saved content"),
      text: String(item?.text || ""),
    }))
    .filter((item) => item.text.trim().length > 0)
    .map((item) => {
      const sentences = splitSentences(item.text);
      const sentenceWordSets = sentences
        .map((sentence) => new Set(sentenceWords(sentence)))
        .filter((set) => set.size >= 4);
      const allWords = sentenceWords(item.text);
      return {
        title: item.title,
        normalizedText: normalizeText(item.text),
        sentenceWordSets,
        shingles: wordShingles(allWords, 8),
      };
    });

  const checkedItems = sources.length;
  const emptyDocument = !String(documentText || "").trim();

  const eligible = splitSentences(documentText)
    .map((sentence) => ({ original: sentence, words: sentenceWords(sentence) }))
    .filter((entry) => entry.words.length >= 4);

  const report = {
    percentage: 0,
    totalSentences: eligible.length,
    matchedSentences: 0,
    checkedItems,
    shortDocument: eligible.length < 2,
    emptyDocument,
    sources: [],
    matches: [],
  };

  if (eligible.length === 0 || sources.length === 0) return report;

  const perSourceCount = new Map();
  for (const entry of eligible) {
    const wordSet = new Set(entry.words);
    const shingles = wordShingles(entry.words, 8);
    const normalizedSentence = normalizeText(entry.original);

    let best = null;
    let bestShared = 0;
    let bestJaccard = 0;
    sources.forEach((source, sourceIndex) => {
      const match = matchSentenceAgainstSource(
        entry.words,
        wordSet,
        shingles,
        normalizedSentence,
        source
      );
      const isMatch =
        match.sharedShingles >= 1 ||
        match.bestJaccard >= 0.6 ||
        match.verbatimShort;
      if (!isMatch) return;
      if (
        match.sharedShingles > bestShared ||
        (match.sharedShingles === bestShared && match.bestJaccard > bestJaccard)
      ) {
        best = sourceIndex;
        bestShared = match.sharedShingles;
        bestJaccard = match.bestJaccard;
      }
    });

    if (best !== null) {
      const title = sources[best].title;
      perSourceCount.set(title, (perSourceCount.get(title) || 0) + 1);
      report.matches.push({ sentence: entry.original, sourceTitle: title });
    }
  }

  report.matchedSentences = report.matches.length;
  report.percentage =
    eligible.length > 0
      ? Math.round((100 * report.matchedSentences) / eligible.length)
      : 0;
  report.sources = [...perSourceCount.entries()]
    .map(([title, matchedCount]) => ({
      title,
      matchedCount,
      percent: Math.round((100 * matchedCount) / eligible.length),
    }))
    .sort((a, b) => b.matchedCount - a.matchedCount);

  return report;
}

// Plain-text summary of a report (history PDF download / sharing).
export function plagiarismReportAsText(report) {
  if (!report || typeof report.percentage !== "number") return "";
  const lines = [
    `Plagiarism check: ${report.percentage}% similarity.`,
    `Checked against ${report.checkedItems || 0} saved items in your StudyFlow library (your own saved materials only — not the internet).`,
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
