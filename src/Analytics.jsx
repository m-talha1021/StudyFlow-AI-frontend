// ========================================================
// STUDYFLOW AI — DASHBOARD ANALYTICS
// ========================================================
// Analytics section rendered inside the Dashboard (App.jsx).
// Presentational only: it takes the data the Dashboard already
// loaded (dashboardStats + the three history lists) as props
// and computes everything client-side — no new queries, no new
// collections, no writes, no AI calls.
//   users/{uid} counters: totalMaterials, studySessions,
//     completedQuizzes, totalQuizScore, flashcardsCreated
//     (average quiz score = totalQuizScore / completedQuizzes)
//   users/{uid}/materialHistory: { fileNames[], createdAt }
//   users/{uid}/flashcardHistory: { cards[], fileNames[], createdAt }
//   users/{uid}/generatedHistory: { title, type, kind, content,
//     sourceFiles[], language, mode, createdAt }
// All createdAt values are Date.now() milliseconds.
// NOTE: quiz/test results are stored only as an aggregate
// percentage in the user doc — no per-question correctness and
// no per-topic data exists anywhere, so there is deliberately
// NO weak-topics card here (it would have to be invented).
// ========================================================

import { useMemo } from "react";

// --- Pure date helpers (exported for the round61 logic test) ---

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, count) {
  const d = new Date(date);
  d.setDate(d.getDate() + count);
  return d;
}

export function toDayKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDayKey(dayKey) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// createdAt in the app is always Date.now() (a number), but be
// tolerant of Firestore Timestamps and Date objects too.
export function createdAtMillis(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value.toMillis === "function") {
    const ms = value.toMillis();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (value instanceof Date) return value.getTime();
  return 0;
}

// Set of local "YYYY-MM-DD" keys on which at least one history
// item was created.
export function collectActivityDays(items) {
  const days = new Set();
  for (const item of items || []) {
    const ms = createdAtMillis(item?.createdAt);
    if (ms > 0) days.add(toDayKey(ms));
  }
  return days;
}

// One bucket per day for the last 7 days (today-6 .. today).
// Each bucket: { date: "YYYY-MM-DD", label: "Fri 21", count }.
export function weeklyBuckets(items, today = new Date()) {
  const counts = new Map();
  for (const item of items || []) {
    const ms = createdAtMillis(item?.createdAt);
    if (ms > 0) {
      const key = toDayKey(ms);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const buckets = [];
  for (let i = 6; i >= 0; i--) {
    const day = addDays(startOfDay(today), -i);
    const key = toDayKey(day);
    buckets.push({
      date: key,
      label: day.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
      }),
      count: counts.get(key) || 0,
    });
  }
  return buckets;
}

// Current streak: consecutive active days ending today — or
// yesterday, so the streak is not lost just because the user
// has not studied yet today. Best streak: the longest run
// anywhere in the history.
export function computeStreaks(activeDays, today = new Date()) {
  const days = activeDays instanceof Set ? activeDays : new Set();
  if (days.size === 0) return { current: 0, best: 0 };

  const has = (date) => days.has(toDayKey(date));

  let cursor = startOfDay(today);
  if (!has(cursor)) cursor = addDays(cursor, -1);
  let current = 0;
  while (has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  // Longest run: sort the day keys and count consecutive days.
  const sorted = [...days].sort().map(parseDayKey);
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === 86400000) {
      run++;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return { current, best };
}

// --- Dashboard analytics section (props-driven, no fetching) ---

export function DashboardAnalytics({
  stats,
  materials,
  flashcards,
  generated,
  loading = false,
}) {
  const counters = stats || {
    totalMaterials: 0,
    studySessions: 0,
    completedQuizzes: 0,
    totalQuizScore: 0,
    flashcardsCreated: 0,
  };

  const allItems = useMemo(
    () => [...(materials || []), ...(flashcards || []), ...(generated || [])],
    [materials, flashcards, generated]
  );

  const buckets = useMemo(() => weeklyBuckets(allItems), [allItems]);
  const weekTotal = useMemo(
    () => buckets.reduce((sum, b) => sum + b.count, 0),
    [buckets]
  );
  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));

  const hasAnyData =
    allItems.length > 0 ||
    counters.totalMaterials > 0 ||
    counters.studySessions > 0 ||
    counters.completedQuizzes > 0 ||
    counters.flashcardsCreated > 0;

  return (
    <div className="sf-progress-analytics">
      {loading ? (
        <p className="sf-progress-loading">Loading your progress…</p>
      ) : !hasAnyData ? (
        <div className="sf-progress-empty">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4f46e5"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 3v18h18" />
            <path d="M7 15l4-5 3 3 5-7" />
          </svg>
          <h2>No activity yet</h2>
          <p>
            Generate your first summary or quiz to see your progress here.
          </p>
        </div>
      ) : (
        <>
          <section className="sf-progress-section" aria-label="Weekly activity">
            <div className="sf-progress-section-head">
              <h2>Activity this week</h2>
              <span className="sf-progress-week-total">
                {weekTotal} {weekTotal === 1 ? "activity" : "activities"} in
                the last 7 days
              </span>
            </div>
            <div className="sf-progress-chart">
              {buckets.map((bucket) => (
                <div
                  key={bucket.date}
                  className="sf-progress-bar-wrap"
                  title={`${bucket.label} — ${bucket.count} ${
                    bucket.count === 1 ? "activity" : "activities"
                  }`}
                >
                  <span className="sf-progress-bar-count">
                    {bucket.count > 0 ? bucket.count : ""}
                  </span>
                  <div
                    className="sf-progress-bar"
                    style={{
                      height: `${Math.max(
                        bucket.count > 0 ? 8 : 3,
                        Math.round((bucket.count / maxBucket) * 110)
                      )}px`,
                    }}
                  />
                  <span className="sf-progress-bar-label">
                    {bucket.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="sf-progress-chart-note">
              Each bar counts materials uploaded, flashcard sets and generated
              items on that day.
            </p>
          </section>

        </>
      )}
    </div>
  );
}
