// ========================================================
// STUDYFLOW AI — STUDY PLANNER
// ========================================================
// Local, deterministic exam planner: no AI call, no quota,
// no backend. A plan lives in users/{uid}/studyPlans:
//   { name, examDate (ISO "YYYY-MM-DD"), topics[],
//     minutesPerDay, studyDays [0-6, JS getDay()],
//     schedule [{ date, topic, minutes, done }], createdAt }
// Schedule: study days run from tomorrow through the day
// before the exam, only on the chosen weekdays. Topics are
// dealt one per day, cycling when they run out; the last 2
// study days before the exam are "Revision" (no new topic).
// ========================================================

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { SubPageShell } from "./phase2.jsx";

// Weekday pickers, Monday first (values are JS getDay() numbers).
export const PLANNER_WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const REVISION_TOPIC = "Revision";

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(date, count) {
  const d = new Date(date);
  d.setDate(d.getDate() + count);
  return d;
}

// Whole days from today until the exam date (0 = exam is today,
// negative = the exam has passed).
export function daysUntilExam(examDate, today = new Date()) {
  return Math.round(
    (startOfDay(parseISODate(examDate)) - startOfDay(today)) / 86400000
  );
}

export function formatPlanDate(isoDate) {
  return parseISODate(isoDate).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Pure + deterministic: same inputs always build the same schedule.
// Returns [] when no study day falls between tomorrow and the exam.
export function generateSchedule({
  examDate,
  topics,
  minutesPerDay,
  studyDays,
  today = new Date(),
}) {
  const cleanTopics = (topics || [])
    .map((t) => String(t).trim())
    .filter(Boolean);
  const days = new Set(studyDays || []);
  if (!cleanTopics.length || !days.size) return [];

  const start = addDays(startOfDay(today), 1); // study starts tomorrow
  const end = addDays(parseISODate(examDate), -1); // day before the exam
  const studyDates = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    if (days.has(d.getDay())) studyDates.push(new Date(d));
  }
  if (!studyDates.length) return [];

  const revisionCount = Math.min(2, studyDates.length);
  const topicDates = studyDates.slice(0, studyDates.length - revisionCount);
  const schedule = topicDates.map((date, i) => ({
    date: toISODate(date),
    // One topic per day; cycle back to the first topic when they run out.
    topic: cleanTopics[i % cleanTopics.length],
    minutes: minutesPerDay,
    done: false,
  }));
  studyDates.slice(studyDates.length - revisionCount).forEach((date) => {
    schedule.push({
      date: toISODate(date),
      topic: REVISION_TOPIC,
      minutes: minutesPerDay,
      done: false,
    });
  });
  return schedule;
}

function planProgress(plan) {
  const total = (plan.schedule || []).length;
  const done = (plan.schedule || []).filter((day) => day.done).length;
  return {
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
}

function sortPlansNewestFirst(plans) {
  return [...plans].sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });
}

export function StudyPlannerPage({ user, onBack }) {
  const uid = user?.uid;
  const [plans, setPlans] = useState(null); // null = still loading
  const [loadError, setLoadError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [openPlanId, setOpenPlanId] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // --- Create-plan form state ---
  const [planName, setPlanName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [topicsText, setTopicsText] = useState("");
  const [minutesPerDay, setMinutesPerDay] = useState(60);
  const [studyDays, setStudyDays] = useState([1, 2, 3, 4, 5, 6, 0]);

  const loadPlans = async () => {
    if (!db || !uid) return;
    setLoadError("");
    try {
      const snapshot = await getDocs(
        query(
          collection(db, "users", uid, "studyPlans"),
          orderBy("createdAt", "desc")
        )
      );
      setPlans(
        sortPlansNewestFirst(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        )
      );
    } catch (err) {
      setLoadError("Could not load your study plans. Please try again.");
      setPlans([]);
    }
  };

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const toggleStudyDay = (value) => {
    setStudyDays((days) =>
      days.includes(value)
        ? days.filter((d) => d !== value)
        : [...days, value]
    );
  };

  const handleCreatePlan = async (event) => {
    event.preventDefault();
    setFormError("");
    const topics = topicsText
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    const minutes = Math.max(5, Math.min(480, Number(minutesPerDay) || 60));
    if (!planName.trim()) {
      setFormError("Give your plan a name.");
      return;
    }
    if (!examDate) {
      setFormError("Pick your exam date.");
      return;
    }
    if (daysUntilExam(examDate) < 1) {
      setFormError("Your exam date must be in the future.");
      return;
    }
    if (!topics.length) {
      setFormError("Add at least one topic (one per line).");
      return;
    }
    if (!studyDays.length) {
      setFormError("Pick at least one study day.");
      return;
    }
    const schedule = generateSchedule({
      examDate,
      topics,
      minutesPerDay: minutes,
      studyDays,
    });
    if (!schedule.length) {
      setFormError(
        "No study days fall between tomorrow and your exam — pick more weekdays or a later exam date."
      );
      return;
    }
    if (!db || !uid) {
      setFormError(
        "Study Planner is unavailable right now. Please try again."
      );
      return;
    }
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "users", uid, "studyPlans"), {
        name: planName.trim(),
        examDate,
        topics,
        minutesPerDay: minutes,
        studyDays,
        schedule,
        createdAt: serverTimestamp(),
      });
      setPlanName("");
      setExamDate("");
      setTopicsText("");
      setMinutesPerDay(60);
      setStudyDays([1, 2, 3, 4, 5, 6, 0]);
      setShowForm(false);
      await loadPlans();
      setOpenPlanId(ref.id);
    } catch (err) {
      setFormError("Could not save this plan. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleDayDone = async (plan, day) => {
    if (!db || !uid) return;
    const schedule = (plan.schedule || []).map((d) =>
      d.date === day.date ? { ...d, done: !d.done } : d
    );
    // Optimistic: flip it on screen immediately, then persist.
    setPlans((current) =>
      (current || []).map((p) => (p.id === plan.id ? { ...p, schedule } : p))
    );
    try {
      await updateDoc(doc(db, "users", uid, "studyPlans", plan.id), {
        schedule,
      });
    } catch (err) {
      // Persist failed — reload the saved state so the checkbox
      // never disagrees with Firestore.
      loadPlans();
    }
  };

  const deletePlan = async (plan) => {
    if (!db || !uid) return;
    if (
      !window.confirm(`Delete the plan "${plan.name}"? This cannot be undone.`)
    ) {
      return;
    }
    setDeletingId(plan.id);
    try {
      await deleteDoc(doc(db, "users", uid, "studyPlans", plan.id));
      setPlans((current) => (current || []).filter((p) => p.id !== plan.id));
      if (openPlanId === plan.id) setOpenPlanId(null);
    } catch (err) {
      alert("Could not delete this plan. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const openPlan = openPlanId
    ? (plans || []).find((p) => p.id === openPlanId) || null
    : null;

  return (
    <SubPageShell
      title="Study Planner"
      subtitle="Your exam countdown, planned day by day. Schedules are built instantly on your device — no AI calls used."
      onBack={onBack}
    >
      {openPlan ? (
        <PlanDetail
          plan={openPlan}
          onBack={() => setOpenPlanId(null)}
          onToggleDay={(day) => toggleDayDone(openPlan, day)}
          onDelete={() => deletePlan(openPlan)}
          deleting={deletingId === openPlan.id}
        />
      ) : (
        <>
          <div className="sf-planner-toolbar">
            <button
              type="button"
              className="sf2-primary-button sf-planner-new-button"
              onClick={() => {
                setShowForm((show) => !show);
                setFormError("");
              }}
            >
              {showForm ? "Cancel" : "New plan"}
            </button>
          </div>
          {showForm && (
            <form
              className="sf-planner-form"
              onSubmit={handleCreatePlan}
            >
              <div className="sf-planner-form-grid">
                <label className="sf-planner-field">
                  Plan name / subject
                  <input
                    type="text"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="e.g. Biology final exam"
                    maxLength={80}
                  />
                </label>
                <label className="sf-planner-field">
                  Exam date
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                  />
                </label>
                <label className="sf-planner-field sf-planner-field-full">
                  Topics
                  <span className="sf-planner-field-hint">
                    One topic per line — each study day covers one topic.
                  </span>
                  <textarea
                    value={topicsText}
                    onChange={(e) => setTopicsText(e.target.value)}
                    placeholder={"Photosynthesis\nCell structure\nGenetics"}
                    rows={4}
                  />
                </label>
                <label className="sf-planner-field">
                  Minutes per day
                  <input
                    type="number"
                    value={minutesPerDay}
                    onChange={(e) => setMinutesPerDay(e.target.value)}
                    min={5}
                    max={480}
                    step={5}
                  />
                </label>
                <div className="sf-planner-field">
                  <span>Study days</span>
                  <div className="sf-planner-weekdays">
                    {PLANNER_WEEKDAYS.map((day) => (
                      <label
                        key={day.value}
                        className={`sf-planner-weekday${
                          studyDays.includes(day.value)
                            ? " sf-planner-weekday-checked"
                            : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={studyDays.includes(day.value)}
                          onChange={() => toggleStudyDay(day.value)}
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              {formError && (
                <p className="sf-planner-form-error" role="alert">
                  {formError}
                </p>
              )}
              <div className="sf-planner-form-actions">
                <button
                  type="submit"
                  className="sf2-primary-button"
                  disabled={saving}
                >
                  {saving ? "Creating plan…" : "Create plan"}
                </button>
                <button
                  type="button"
                  className="sf2-secondary-button"
                  onClick={() => {
                    setShowForm(false);
                    setFormError("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loadError && <p className="sf2-error">{loadError}</p>}

          {plans === null ? (
            <p className="sf-planner-meta">Loading your plans…</p>
          ) : plans.length === 0 && !showForm ? (
            <div className="sf-planner-empty">
              <svg
                className="sf-planner-empty-icon"
                width="56"
                height="56"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4f46e5"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <path d="M9 16l2 2 4-4" />
              </svg>
              <h2>No study plans yet</h2>
              <p>
                Pick an exam date and your topics, and StudyQue will lay
                out a day-by-day plan for you — with revision days saved
                for the end.
              </p>
              <button
                type="button"
                className="sf2-primary-button"
                onClick={() => setShowForm(true)}
              >
                Create your first plan
              </button>
            </div>
          ) : (
            <div className="sf-planner-list">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onOpen={() => setOpenPlanId(plan.id)}
                  onDelete={() => deletePlan(plan)}
                  deleting={deletingId === plan.id}
                />
              ))}
            </div>
          )}
        </>
      )}
    </SubPageShell>
  );
}

function PlanCard({ plan, onOpen, onDelete, deleting }) {
  const progress = planProgress(plan);
  const daysLeft = daysUntilExam(plan.examDate);
  const examDone = daysLeft < 0;
  return (
    <article className="sf-planner-card">
      <div className="sf-planner-card-top">
        <h2>{plan.name}</h2>
        <span
          className={`sf-planner-badge${
            examDone ? " sf-planner-badge-done" : ""
          }`}
        >
          {examDone
            ? "Exam done"
            : daysLeft === 0
              ? "Exam today"
              : daysLeft === 1
                ? "1 day left"
                : `${daysLeft} days left`}
        </span>
      </div>
      <p className="sf-planner-meta">
        Exam: {formatPlanDate(plan.examDate)} · {plan.minutesPerDay} min/day
      </p>
      <div
        className="sf-planner-progress"
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress for ${plan.name}`}
      >
        <div
          className="sf-planner-progress-fill"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <p className="sf-planner-progress-text">
        {progress.done} of {progress.total} days done ({progress.percent}%)
      </p>
      <div className="sf-planner-card-actions">
        <button
          type="button"
          className="sf2-primary-button"
          onClick={onOpen}
        >
          Open plan
        </button>
        <button
          type="button"
          className="sf-planner-delete-button"
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </article>
  );
}

function PlanDetail({ plan, onBack, onToggleDay, onDelete, deleting }) {
  const progress = planProgress(plan);
  const daysLeft = daysUntilExam(plan.examDate);
  const examDone = daysLeft < 0;
  return (
    <div>
      <div className="sf-planner-detail-head">
        <h2>{plan.name}</h2>
        <button
          type="button"
          className="sf-planner-delete-button"
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? "Deleting…" : "Delete plan"}
        </button>
      </div>
      <p className="sf-planner-detail-meta">
        Exam: {formatPlanDate(plan.examDate)} · {plan.minutesPerDay} min/day
        {" · "}
        {examDone
          ? "Exam done"
          : daysLeft === 0
            ? "Exam is today"
            : daysLeft === 1
              ? "1 day left until exam"
              : `${daysLeft} days left until exam`}
      </p>
      {examDone && (
        <p className="sf-planner-exam-done">
          This exam has passed — the plan is kept here for your records.
        </p>
      )}
      <div
        className="sf-planner-progress"
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress for ${plan.name}`}
      >
        <div
          className="sf-planner-progress-fill"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <p className="sf-planner-progress-text">
        {progress.done} of {progress.total} days done ({progress.percent}%)
      </p>
      <ul className="sf-planner-days">
        {(plan.schedule || []).map((day) => (
          <li
            key={day.date}
            className={`sf-planner-day-row${
              day.done ? " sf-planner-day-done" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={!!day.done}
              disabled={examDone}
              onChange={() => onToggleDay(day)}
              aria-label={`Mark ${formatPlanDate(day.date)} as done`}
            />
            <span className="sf-planner-day-date">
              {formatPlanDate(day.date)}
            </span>
            <span
              className={`sf-planner-day-topic${
                day.topic === REVISION_TOPIC
                  ? " sf-planner-day-topic-revision"
                  : ""
              }`}
            >
              {day.topic}
            </span>
            <span className="sf-planner-day-minutes">
              {day.minutes} min
            </span>
          </li>
        ))}
      </ul>
      <div className="sf-planner-form-actions">
        <button
          type="button"
          className="sf2-secondary-button"
          onClick={onBack}
        >
          ← All plans
        </button>
      </div>
    </div>
  );
}
