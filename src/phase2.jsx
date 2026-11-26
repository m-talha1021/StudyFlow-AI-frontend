// ========================================================
// STUDYFLOW AI — PHASE 2 VIEWS
// ========================================================
// Plans / upgrade UI (free-only, Pro is "coming soon" — no
// Stripe.js, no checkout call), legal pages, Settings page
// (profile, plan, account deletion), and first-run onboarding
// with a built-in sample lecture. All views are state-based,
// like the rest of the app (no router).
// ========================================================

import { useState } from "react";
import {
  GoogleAuthProvider,
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "./firebase";

// --------------------------------------------------------
// PLANS
// --------------------------------------------------------
// Free quotas match the Phase 1 backend caps. Pro is fixed at 150 AI
// calls and 280 transcription minutes per day.
// The backend reads a `plan` field on users/{uid}; a missing
// field means "free". Pro is NOT for sale yet — the upgrade
// button is disabled and labelled "coming soon".

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: "Rs. 0",
    aiCallsPerDay: 5,
    transcriptionMinutesPerDay: 20,
    features: [
      "5 AI calls per day (summary, quiz, flashcards, chat, tests)",
      "20 transcription minutes per day",
      "Unlimited file conversion (client-side)",
      "Study history & shared result links",
      "Fun Zone games",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: "Coming soon",
    aiCallsPerDay: 150,
    transcriptionMinutesPerDay: 280,
    features: [
      "150 AI calls per day — 30x the Free plan",
      "280 transcription minutes per day — 14x the Free plan",
      "Everything in Free",
      "Priority generation when the service is busy",
      "Early access to new features",
    ],
  },
};

export function getPlanId(planValue) {
  return planValue === "pro" ? "pro" : "free";
}

// --------------------------------------------------------
// SAMPLE LECTURE (onboarding)
// --------------------------------------------------------
// A short general-knowledge lecture, embedded as text so a
// new user can try Summary / Flashcards / Quiz instantly
// without uploading anything.

export const SAMPLE_LECTURE_TEXT = `Photosynthesis: How Plants Make Food from Sunlight

Photosynthesis is the process by which green plants, algae, and some bacteria convert sunlight, water, and carbon dioxide into food and oxygen. It is one of the most important biological processes on Earth, because nearly all life depends on it, either directly or indirectly, for energy and oxygen.

The word photosynthesis comes from two Greek words: "photo", meaning light, and "synthesis", meaning to put together. In simple terms, plants use light energy to put together simple molecules into energy-rich food. The overall chemical equation is: six molecules of carbon dioxide plus six molecules of water, in the presence of sunlight and chlorophyll, produce one molecule of glucose and six molecules of oxygen.

Photosynthesis takes place mainly in the leaves of plants, inside tiny organelles called chloroplasts. Chloroplasts contain a green pigment called chlorophyll, which absorbs sunlight, mostly in the blue and red parts of the spectrum, and reflects green light — which is why leaves look green. Inside the chloroplast, the process happens in two main stages: the light-dependent reactions and the light-independent reactions, also called the Calvin cycle.

The light-dependent reactions take place in the thylakoid membranes of the chloroplast. When chlorophyll absorbs sunlight, the light energy splits water molecules into hydrogen ions, electrons, and oxygen gas. The oxygen is released into the air as a by-product — this is the oxygen we breathe. The light energy is also used to produce two energy-carrying molecules, ATP and NADPH, which store energy for the next stage.

The second stage, the Calvin cycle, takes place in the stroma, the fluid part of the chloroplast. Here, the ATP and NADPH produced in the first stage provide the energy to fix carbon dioxide from the air into glucose and other sugars. These sugars are the plant's food. The plant uses glucose immediately for energy through respiration, stores it as starch for later use, or converts it into cellulose to build cell walls and grow.

Several factors affect the rate of photosynthesis. Light intensity matters: more light generally increases the rate, up to a point where other factors become limiting. Carbon dioxide concentration also matters, because carbon dioxide is a raw material. Temperature matters too, because the enzymes of the Calvin cycle work best in a moderate range — too cold and the reactions slow down, too hot and the enzymes are damaged. Water availability is equally important: when water is scarce, plants close tiny pores in their leaves called stomata to save water, but closed stomata also block carbon dioxide from entering, which slows photosynthesis.

Photosynthesis matters far beyond the plant itself. It produces almost all the oxygen in our atmosphere, and it forms the base of nearly every food chain on Earth. Herbivores eat plants, carnivores eat herbivores, and decomposers break down dead organisms — all of this energy originally came from sunlight captured by photosynthesis. Fossil fuels such as coal, oil, and natural gas are also ancient stored sunlight: they formed from the remains of photosynthetic organisms buried millions of years ago.

In summary, photosynthesis converts light energy into chemical energy stored in glucose, releases oxygen, and sustains life on Earth. Understanding it helps us understand food production, climate, and why protecting forests and green spaces matters for everyone.`;

// --------------------------------------------------------
// SHARED SHELL FOR IN-APP PAGES
// --------------------------------------------------------

function SubPageShell({ title, subtitle, onBack, backLabel = "Go back", children }) {
  return (
    <main className="sf2-page">
      <button type="button" className="sf2-back-button" onClick={onBack}>
        ← {backLabel}
      </button>
      <h1>{title}</h1>
      {subtitle && <p className="sf2-page-subtitle">{subtitle}</p>}
      {children}
    </main>
  );
}

// --------------------------------------------------------
// LEGAL PAGES
// --------------------------------------------------------

function LegalPage({ title, updated, onBack, children }) {
  return (
    <SubPageShell title={title} subtitle={`Last updated: ${updated}`} onBack={onBack}>
      <article className="sf2-legal">{children}</article>
    </SubPageShell>
  );
}

export function PrivacyPolicyPage({ onBack }) {
  return (
    <LegalPage title="Privacy Policy" updated="26 November 2026" onBack={onBack}>
      <p>
        StudyFlow AI (“we”, “the app”) helps you turn your study material —
        notes, documents, images, and lecture recordings — into summaries,
        explanations, quizzes, flashcards, tests, and an AI study assistant.
        This policy explains what data we collect, why we collect it, and
        what choices you have.
      </p>
      <h2>1. Data we collect</h2>
      <p><strong>Account data.</strong> When you create an account we collect
        your name and email address, and store them with your Firebase
        Authentication account. If you sign in with Google, we receive the
        name and email address from your Google account.</p>
      <p><strong>Study materials and results.</strong> The notes, documents,
        images, and lecture recordings you upload or paste, and the summaries,
        quizzes, flashcards, and other results generated from them, are stored
        in your private account so you can revisit them in your history. Only
        you can see them, unless you choose to share a result using a share
        link — anyone with that link can view that single result.</p>
      <p><strong>Usage data.</strong> We count how many materials you have
        processed, how many study sessions you completed, and how many AI
        calls you made, so we can show your progress and enforce the daily
        limits of your plan. If analytics is enabled, we also collect
        anonymous, aggregated usage statistics (for example, which features
        are used most) to improve the app.</p>
      <p><strong>Feedback.</strong> If you send feedback through the app, we
        receive the message you wrote, the feedback type you selected, and
        your display name.</p>
      <p><strong>Cookies.</strong> We use a small local cookie/local-storage
        entry only to remember whether you accepted or declined the cookie
        notice, and Firebase uses its own cookies to keep you signed in.
        We do not use advertising cookies.</p>
      <h2>2. How your material is processed</h2>
      <p>
        To generate summaries, quizzes, flashcards, and answers, your study
        material is sent to our backend and then to third-party AI providers
        (currently Google Gemini, Groq, and OpenRouter, with OpenAI only as
        an optional fallback). Lecture audio is transcribed by Groq Whisper.
        These providers process your material only to produce the result you
        asked for; they do not use it to train their models under our
        current configuration, and we do not sell your data to anyone.
        Your material is never shared with other users.
      </p>
      <h2>3. How we store and protect your data</h2>
      <p>
        Account and study data is stored in Google Firebase (Authentication
        and Firestore). Access is restricted by security rules so that only
        you — signed in as your account — can read or change your data.
        Shared results are readable only by someone who has the unguessable
        share link. We take reasonable steps to protect your data, but no
        internet service can guarantee absolute security.
      </p>
      <h2>4. Data retention</h2>
      <p>
        We keep your account data, study materials, and history for as long
        as your account exists, so your history stays available to you. You
        can delete your account and all of its data at any time from
        Settings → Delete account (see section 5).
      </p>
      <h2>5. Deleting your account and data</h2>
      <p>
        You can permanently delete your account from inside the app:
        go to <strong>Settings → Delete account</strong> and confirm. This
        deletes your profile, your study history, and your generated results
        from our database, and then deletes your sign-in account. This cannot
        be undone. Results you shared with a link are not deleted by this
        step; contact us if you need a shared link removed.
      </p>
      <h2>6. Your choices</h2>
      <p>
        You can update your display name in Settings, change your password
        from the login screen, and delete your account as described above.
        You may also decline cookies; the app will still work.
      </p>
      <h2>7. Children</h2>
      <p>
        StudyFlow AI is intended for students aged 13 and over. If you are
        under 13, please only use the app with a parent or guardian’s
        permission.
      </p>
      <h2>8. Changes to this policy</h2>
      <p>
        If we change this policy in a meaningful way, we will update the
        “Last updated” date above. Continued use of the app after a change
        means you accept the updated policy.
      </p>
      <h2>9. Contact</h2>
      <p>
        Questions about this policy or your data can be sent through the
        in-app Feedback form (choose “General feedback”).
      </p>
    </LegalPage>
  );
}

export function TermsOfServicePage({ onBack }) {
  return (
    <LegalPage title="Terms of Service" updated="26 November 2026" onBack={onBack}>
      <p>
        These Terms of Service (“Terms”) govern your use of StudyFlow AI.
        By creating an account or using the app, you agree to these Terms.
        If you do not agree, please do not use the app.
      </p>
      <h2>1. What StudyFlow AI does</h2>
      <p>
        StudyFlow AI turns your study material into summaries, explanations,
        quizzes, flashcards, tests, oral exams, and an AI chat assistant,
        and can transcribe lecture recordings into text. Features may change
        over time as we improve the app.
      </p>
      <h2>2. Your account</h2>
      <p>
        You are responsible for keeping your sign-in details safe and for
        everything done under your account. You must provide an email address
        you own and verify it before using the app. You must be at least 13
        years old, or use the app with a parent or guardian’s permission.
        We may suspend or close accounts that break these Terms.
      </p>
      <h2>3. Acceptable use</h2>
      <p>
        You agree to use the app only for lawful study purposes. You must
        not: upload material you do not have the right to use; use the app
        to cheat in a way your institution forbids (for example, submitting
        AI-generated work as your own where that is against your
        institution’s rules); try to access other users’ data; abuse, overload,
        or attempt to bypass the daily usage limits; or resell or redistribute
        the service. AI-generated content can be wrong — always check important
        facts in your own course material before relying on them, especially
        before an exam.
      </p>
      <h2>4. Your content</h2>
      <p>
        You keep ownership of the study material you upload or paste. By
        using the app, you give us permission to process that material only
        to provide the features you request (including sending it to the AI
        providers described in our Privacy Policy) and to store the results
        in your private history. We do not claim ownership of your material
        and we do not sell it.
      </p>
      <h2>5. Plans and limits</h2>
      <p>
        StudyFlow AI is currently free to use. The Free plan includes daily
        limits (5 AI calls and 20 transcription minutes per day). A paid
        Pro plan with higher limits is planned and will be announced in the
        app when it becomes available; no payment is collected today. Limits
        may change as the service grows, and we will show the current limits
        on the Plans page.
      </p>
      <h2>6. Availability and accuracy</h2>
      <p>
        The app is provided “as is” and “as available”. AI features depend
        on third-party providers and may occasionally be slow, unavailable,
        or produce inaccurate or incomplete results. We do not guarantee that
        the service will always be available or error-free, and we are not
        liable for study outcomes, exam results, or decisions made based on
        AI-generated content.
      </p>
      <h2>7. Account deletion</h2>
      <p>
        You can delete your account at any time from Settings → Delete
        account. Deletion permanently removes your profile, study history,
        and generated results, and cannot be undone.
      </p>
      <h2>8. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. The “Last updated” date
        above will change, and continued use of the app after an update means
        you accept the new Terms.
      </p>
      <h2>9. Governing law</h2>
      <p>
        These Terms are governed by the laws of Pakistan. Any dispute will be
        handled in the courts of Pakistan.
      </p>
    </LegalPage>
  );
}

// --------------------------------------------------------
// PLANS PAGE
// --------------------------------------------------------

export function PlansPage({ currentPlan, onBack, backLabel = "Go back" }) {
  // A null/undefined currentPlan means "no signed-in user": the plans are
  // shown plainly, with no "current plan" markers at all (no badge, no
  // "You are on Free" button on the Free card).
  const current = currentPlan == null ? null : getPlanId(currentPlan);
  return (
    <SubPageShell
      title="Plans"
      subtitle="StudyFlow AI is free for now. Pro — with 10x the daily limits — is coming soon."
      onBack={onBack}
      backLabel={backLabel}
    >
      <div className="sf2-plans-grid">
        {[PLANS.free, PLANS.pro].map((plan) => {
          const isCurrent = plan.id === current;
          const isPro = plan.id === "pro";
          return (
            <article
              key={plan.id}
              className={`sf2-plan-card${isPro ? " sf2-plan-card-pro" : ""}${isCurrent ? " sf2-plan-card-current" : ""}`}
            >
              {isPro && <span className="sf2-plan-badge">Coming soon</span>}
              {isCurrent && <span className="sf2-plan-badge sf2-plan-badge-current">Your current plan</span>}
              <h2>{plan.name}</h2>
              <p className="sf2-plan-price">{plan.price}</p>
              <p className="sf2-plan-limits">
                <strong>{plan.aiCallsPerDay} AI calls / day</strong>
                <br />
                <strong>{plan.transcriptionMinutesPerDay} transcription minutes / day</strong>
              </p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>
              {isPro ? (
                <button type="button" className="sf2-plan-button" disabled>
                  Pro — coming soon
                </button>
              ) : current === null ? null : isCurrent ? (
                <button type="button" className="sf2-plan-button" disabled>
                  You are on Free
                </button>
              ) : (
                <button type="button" className="sf2-plan-button" disabled>
                  Current plan
                </button>
              )}
            </article>
          );
        })}
      </div>
      <p className="sf2-plans-note">Daily limits reset every day.</p>
    </SubPageShell>
  );
}

// --------------------------------------------------------
// ONBOARDING
// --------------------------------------------------------

export function OnboardingModal({ onLoadSample, onSkip }) {
  return (
    <div className="sf2-onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="sf2-onboarding-title">
      <div className="sf2-onboarding-card">
        <h2 id="sf2-onboarding-title">Welcome to StudyFlow AI 👋</h2>
        <p>
          Turn any lecture or notes into a summary, quiz, flashcards, or a
          test — in seconds. Here is the fastest way to try it:
        </p>
        <ol className="sf2-onboarding-steps">
          <li><strong>Load the sample lecture</strong> below — a short lesson on photosynthesis.</li>
          <li>Pick <strong>Summary</strong>, <strong>Flashcards</strong>, or <strong>Quiz</strong> and press Generate.</li>
          <li>Or upload your own lecture audio, PDF, or notes instead.</li>
        </ol>
        <div className="sf2-onboarding-actions">
          <button type="button" className="sf2-primary-button" onClick={onLoadSample}>
            Try the sample lecture
          </button>
          <button type="button" className="sf2-secondary-button" onClick={onSkip}>
            Skip — I’ll explore on my own
          </button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------
// SETTINGS PAGE
// --------------------------------------------------------

const USER_SUBCOLLECTIONS = ["materialHistory", "flashcardHistory", "generatedHistory"];

async function deleteCollectionDocs(userId, collectionName) {
  const snapshot = await getDocs(collection(db, "users", userId, collectionName));
  // Firestore batches hold at most 500 writes.
  for (let start = 0; start < snapshot.docs.length; start += 400) {
    const batch = writeBatch(db);
    snapshot.docs.slice(start, start + 400).forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  }
  return snapshot.docs.length;
}

export function SettingsPage({ user, currentPlan, onBack, onViewPlans, onSignOut, onAccountDeleted }) {
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const [deleteStep, setDeleteStep] = useState("idle"); // idle | confirm | reauth | deleting
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteInfo, setDeleteInfo] = useState("");

  const isGoogleUser = (user?.providerData || []).some(
    (provider) => provider?.providerId === "google.com"
  );

  const saveDisplayName = async (event) => {
    event.preventDefault();
    const name = displayName.trim();
    if (!name) {
      setProfileMessage("Please enter a display name.");
      return;
    }
    setProfileSaving(true);
    setProfileMessage("");
    try {
      await updateProfile(auth.currentUser, { displayName: name });
      await setDoc(
        doc(db, "users", user.uid),
        { displayName: name, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      setProfileMessage("Display name updated.");
    } catch (error) {
      setProfileMessage(error.message || "Could not update your display name.");
    } finally {
      setProfileSaving(false);
    }
  };

  const deleteAllUserData = async () => {
    let deletedCount = 0;
    for (const name of USER_SUBCOLLECTIONS) {
      deletedCount += await deleteCollectionDocs(user.uid, name);
    }
    await deleteDoc(doc(db, "users", user.uid));
    return deletedCount;
  };

  const runDeletion = async () => {
    setDeleteStep("deleting");
    setDeleteError("");
    setDeleteInfo("");
    try {
      await deleteAllUserData();
      await deleteUser(auth.currentUser);
      onAccountDeleted();
    } catch (error) {
      if (error?.code === "auth/requires-recent-login") {
        setDeleteStep("reauth");
        setDeleteInfo(
          "For your safety, please sign in again to confirm this deletion, then we will delete your account."
        );
        return;
      }
      console.error("Account deletion error:", error);
      setDeleteError(error.message || "Could not delete your account. Please try again.");
      setDeleteStep("confirm");
    }
  };

  const reauthenticateAndDelete = async (event) => {
    event.preventDefault();
    setDeleteError("");
    try {
      if (isGoogleUser) {
        await reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider());
      } else {
        if (!deletePassword) {
          setDeleteError("Please enter your password to confirm.");
          return;
        }
        const credential = EmailAuthProvider.credential(user.email, deletePassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
      }
      await runDeletion();
    } catch (error) {
      console.error("Re-authentication error:", error);
      if (error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential") {
        setDeleteError("That password is incorrect. Please try again.");
      } else if (error?.code === "auth/popup-closed-by-user") {
        setDeleteError("The Google sign-in window was closed. Please try again.");
      } else {
        setDeleteError(error.message || "Could not verify your sign-in. Please try again.");
      }
    }
  };

  return (
    <SubPageShell title="Settings" subtitle="Your profile, plan, and account." onBack={onBack}>
      <section className="sf2-settings-section">
        <h2>Profile</h2>
        <p className="sf2-settings-email">
          Signed in as <strong>{user?.email || "—"}</strong>
          {isGoogleUser ? " (Google account)" : ""}
        </p>
        <form onSubmit={saveDisplayName} className="sf2-settings-form">
          <label>
            Display name
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </label>
          <button type="submit" className="sf2-primary-button" disabled={profileSaving}>
            {profileSaving ? "Saving…" : "Save name"}
          </button>
        </form>
        {profileMessage && <p role="status" className="sf2-settings-message">{profileMessage}</p>}
      </section>

      <section className="sf2-settings-section">
        <h2>Your plan</h2>
        <p>
          You are on the <strong>{getPlanId(currentPlan) === "pro" ? "Pro" : "Free"}</strong> plan
          — {PLANS[getPlanId(currentPlan)].aiCallsPerDay} AI calls and{" "}
          {PLANS[getPlanId(currentPlan)].transcriptionMinutesPerDay} transcription minutes per day.
        </p>
        <button type="button" className="sf2-secondary-button" onClick={onViewPlans}>
          View plans
        </button>
      </section>

      <section className="sf2-settings-section">
        <h2>Sign out</h2>
        <button type="button" className="sf2-secondary-button" onClick={onSignOut}>
          Sign out
        </button>
      </section>

      <section className="sf2-settings-section sf2-danger-zone">
        <h2>Delete account</h2>
        <p>
          Permanently delete your account, your profile, your study history,
          and all generated results. This cannot be undone. Results you
          shared with a link will no longer be tied to your account.
        </p>

        {deleteStep === "idle" && (
          <button
            type="button"
            className="sf2-danger-button"
            onClick={() => { setDeleteStep("confirm"); setDeleteError(""); }}
          >
            Delete account…
          </button>
        )}

        {deleteStep === "confirm" && (
          <form
            onSubmit={(event) => { event.preventDefault(); if (deleteConfirmText.trim() === "DELETE") runDeletion(); }}
            className="sf2-delete-confirm"
          >
            <label>
              Type <strong>DELETE</strong> to confirm
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </label>
            {deleteError && <p role="alert" className="sf2-error">{deleteError}</p>}
            <div className="sf2-delete-actions">
              <button
                type="submit"
                className="sf2-danger-button"
                disabled={deleteConfirmText.trim() !== "DELETE"}
              >
                Permanently delete my account
              </button>
              <button
                type="button"
                className="sf2-secondary-button"
                onClick={() => { setDeleteStep("idle"); setDeleteConfirmText(""); setDeleteError(""); }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {deleteStep === "reauth" && (
          <form onSubmit={reauthenticateAndDelete} className="sf2-delete-confirm">
            <p role="status" className="sf2-settings-message">{deleteInfo}</p>
            {isGoogleUser ? (
              <p>Click below to confirm with your Google account, then your account will be deleted.</p>
            ) : (
              <label>
                Your password
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                />
              </label>
            )}
            {deleteError && <p role="alert" className="sf2-error">{deleteError}</p>}
            <div className="sf2-delete-actions">
              <button type="submit" className="sf2-danger-button">
                {isGoogleUser ? "Confirm with Google & delete" : "Confirm & delete my account"}
              </button>
              <button
                type="button"
                className="sf2-secondary-button"
                onClick={() => { setDeleteStep("confirm"); setDeleteError(""); setDeletePassword(""); }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {deleteStep === "deleting" && (
          <p role="status" className="sf2-settings-message">Deleting your account and data…</p>
        )}
      </section>
    </SubPageShell>
  );
}
