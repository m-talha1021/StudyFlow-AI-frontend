import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";

import { auth, db } from "./firebase";

import {
  doc,
  setDoc,
  getDoc,
  increment,
  serverTimestamp,
  addDoc,
  collection,
  getDocs,
} from "firebase/firestore";

import "./App.css";

// ========================================================
// BACKEND API
// ========================================================

const API_BASE_URL =
  (import.meta.env?.VITE_API_BASE_URL ||
    "https://study-flow-ai-backend.vercel.app").replace(/\/+$/, "");

// ========================================================
// API HELPER
// ========================================================

const apiRequest = async (endpoint, options = {}) => {
  const isFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...options,

      headers: {
        ...(isFormData
          ? {}
          : {
              "Content-Type":
                "application/json",
            }),

        ...(options.headers || {}),
      },
    }
  );

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Server returned an invalid response (${response.status}).`
    );
  }

  if (!response.ok || data.success === false) {
    throw new Error(
      data.error ||
        data.message ||
        `Request failed with status ${response.status}.`
    );
  }

  return data;
};

// ========================================================
// AUTH UI
// ========================================================

function BrandMark() {
  return (
    <div className="brand-mark">
      <img src="/favicon.png" alt="StudyFlow AI" />
      <span><b>StudyFlow AI</b></span>
    </div>
  );
}

function WelcomePage({ onLogin, onSignup }) {
  return (
    <div className="auth-shell">
      <nav className="public-navbar">
        <BrandMark />
        <div className="public-nav-actions">
          <button type="button" className="nav-link-button" onClick={onLogin}>
            Login
          </button>
          <button type="button" className="nav-signup-button" onClick={onSignup}>
            Sign Up
          </button>
        </div>
      </nav>

      <main className="welcome-page">
        <section className="welcome-hero">
          <div className="welcome-badge">✦ AI-powered learning</div>
          <h1>
            Study smarter.<br />
            <span>Understand faster.</span>
          </h1>
          <p>
            StudyFlow AI turns your notes, documents and images into summaries,
            explanations, quizzes, flashcards and an interactive study assistant.
          </p>

          <div className="welcome-actions">
            <button type="button" className="primary-auth-button" onClick={onSignup}>
              Get Started
            </button>
            <button type="button" className="secondary-auth-button" onClick={onLogin}>
              I already have an account
            </button>
          </div>

          <div className="feature-grid">
            <div><span>📝</span><strong>Summaries</strong><small>Key ideas from your material</small></div>
            <div><span>💡</span><strong>Explain</strong><small>Understand difficult concepts</small></div>
            <div><span>🧠</span><strong>Quizzes</strong><small>Test what you learned</small></div>
            <div><span>🗂️</span><strong>Flashcards</strong><small>Active recall made easy</small></div>
            <div><span>🤖</span><strong>AI Chat</strong><small>Ask questions about your material</small></div>
          </div>
        </section>
      </main>
    </div>
  );
}

function AuthPage({ mode, onModeChange, onSubmit, onForgotPassword, loading, error, form, setForm }) {
  const isSignup = mode === "signup";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="auth-shell">
      <nav className="public-navbar">
        <BrandMark />
        <button
          type="button"
          className="nav-link-button"
          onClick={() => onModeChange("welcome")}
        >
          ⬅ Back
        </button>
      </nav>

      <main className="auth-page">
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-card-brand">
            <span>StudyFlow AI</span>
          </div>

          <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p>
            {isSignup
              ? "Start your personalized StudyFlow experience."
              : "Log in to continue learning."}
          </p>

          {error && <div className="auth-error">{error}</div>}

          {isSignup && (
            <label>
              Full name
              <input
                type="text"
                value={form.name}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                placeholder="Your full name"
                autoComplete="name"
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  email: event.target.value,
                }))
              }
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <div className="password-field-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    password: event.target.value,
                  }))
                }
                placeholder="your password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
              />
              <button
                type="button"
                className="password-eye-button"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.8 18.8 0 0 1-3.2 4.1" />
                    <path d="M6.2 6.3C3.7 8.1 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1" />
                    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {isSignup && (
            <label>
              Confirm password
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    confirmPassword: event.target.value,
                  }))
                }
                placeholder="Repeat your password"
                autoComplete="new-password"
                required
              />
            </label>
          )}

          {!isSignup && (
            <button
              type="button"
              className="forgot-password-button"
              onClick={onForgotPassword}
              disabled={loading}
            >
              Forgot password?
            </button>
          )}

          <button
            type="submit"
            className="primary-auth-button auth-submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : isSignup
                ? "Create Account"
                : "Login"}
          </button>

          <p className="auth-switch">
            {isSignup
              ? "Already have an account?"
              : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => onModeChange(isSignup ? "login" : "signup")}
              disabled={loading}
            >
              {isSignup ? "Login" : "Sign up"}
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}

// ========================================================
// APP
// ========================================================

function App() {
  // ========================================================
  // FIREBASE AUTHENTICATION
  // ========================================================

  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState("welcome");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // ========================================================
  // LOGGED-IN MOBILE NAVIGATION
  // ========================================================

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);

  // ========================================================
  // DASHBOARD
  // ========================================================

  const [dashboardStats, setDashboardStats] = useState({
    totalMaterials: 0,
    studySessions: 0,
    completedQuizzes: 0,
    totalQuizScore: 0,
    averageQuizScore: 0,
    flashcardsCreated: 0,
  });

  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  // Dashboard history
  const [dashboardHistoryType, setDashboardHistoryType] = useState(null);
  const [dashboardMaterialsHistory, setDashboardMaterialsHistory] = useState([]);
  const [dashboardFlashcardHistory, setDashboardFlashcardHistory] = useState([]);

  // ========================================================
  // GUESS THE WORD GAME
  // ========================================================

  const guessWordBank = [
    "apple", "planet", "school", "science", "computer", "student",
    "teacher", "library", "network", "database", "program", "project",
    "learning", "memory", "concept", "chapter", "subject", "language",
    "history", "physics", "biology", "formula", "process", "function",
    "variable", "internet", "keyboard", "software", "hardware", "storage",
  ];

  const [guessWord, setGuessWord] = useState("");
  const [guessedLetters, setGuessedLetters] = useState([]);
  const [guessInput, setGuessInput] = useState("");
  const [guessTries, setGuessTries] = useState(0);
  const [guessGameStarted, setGuessGameStarted] = useState(false);
  const [guessGameStatus, setGuessGameStatus] = useState("idle");
  const [guessMessage, setGuessMessage] = useState("");

  // ========================================================
  // BALLOON LETTER GAME
  // ========================================================

  const [balloonTargetLetter, setBalloonTargetLetter] = useState("");
  const [balloons, setBalloons] = useState([]);
  const [balloonScore, setBalloonScore] = useState(0);
  const [balloonGameStarted, setBalloonGameStarted] = useState(false);
  const [balloonGameMessage, setBalloonGameMessage] = useState("");

  // Prevent the same quiz from being counted twice.
  const testSubmissionRecordedRef = useRef(false);

  // ========================================================
  // STUDY MATERIAL
  // ========================================================

  const [text, setText] = useState("");
  const [mode, setMode] = useState("summary");
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);

  const [materialReady, setMaterialReady] =
    useState(false);

  const [processing, setProcessing] =
    useState(false);

  const [generating, setGenerating] =
    useState(false);

  const [result, setResult] = useState("");
  const [resultLanguage, setResultLanguage] =
    useState("");

  // ========================================================
  // FLASHCARDS
  // ========================================================

  const [flashcards, setFlashcards] = useState([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);

  // ========================================================
  // TEST CONCEPTS
  // ========================================================

  const [testLoading, setTestLoading] = useState(false);
  const [testQuestions, setTestQuestions] = useState([]);
  const [testAnswers, setTestAnswers] = useState({});
  const [testIndex, setTestIndex] = useState(0);
  const [testStarted, setTestStarted] = useState(false);
  const [testFinished, setTestFinished] = useState(false);
  const [testTimeLeft, setTestTimeLeft] = useState(0);
  const [testTotalSeconds, setTestTotalSeconds] = useState(0);
  const [testScore, setTestScore] = useState(0);

  // ========================================================
  // AI ORAL EXAM
  // ========================================================

  const [oralExam, setOralExam] = useState({
    active: false,
    sessionId: "",
    question: "",
    questionNumber: 0,
    totalQuestions: 0,
    language: "english",
    status: "idle",
    feedback: "",
    score: 0,
    listening: false,
    supported: true,
  });

  const oralRecognitionRef = useRef(null);
  const oralRecognitionActiveRef = useRef(false);

  // ========================================================
  // CHATBOT
  // ========================================================

  const [chatOpen, setChatOpen] =
    useState(false);

  const [chatQuestion, setChatQuestion] =
    useState("");

  const [chatMessages, setChatMessages] =
    useState([]);

  const [chatLoading, setChatLoading] =
    useState(false);

  // ========================================================
  // SPEECH
  // ========================================================

  const [isSpeaking, setIsSpeaking] =
    useState(false);

  // ========================================================
  // CAMERA
  // ========================================================

  const cameraInputRef = useRef(null);

  // ========================================================
  // CHAT SCROLL
  // ========================================================

  const chatMessagesRef = useRef(null);

  // ========================================================
  // GO TO TOP
  // ========================================================

  const [showGoUp, setShowGoUp] =
    useState(false);

  // ========================================================
  // FIREBASE SESSION LISTENER
  // ========================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthChecked(true);

      if (firebaseUser) {
        setAuthView("app");
      }
    });

    return () => unsubscribe();
  }, []);

  // ========================================================
  // LOAD CURRENT USER DASHBOARD
  // ========================================================

  useEffect(() => {
    if (!user?.uid) {
      setDashboardStats({
        totalMaterials: 0,
        studySessions: 0,
        completedQuizzes: 0,
        totalQuizScore: 0,
        averageQuizScore: 0,
        flashcardsCreated: 0,
      });
      setDashboardMaterialsHistory([]);
      setDashboardFlashcardHistory([]);
      setDashboardHistoryType(null);
      return;
    }

    let cancelled = false;

    const loadDashboardStats = async () => {
      setDashboardLoading(true);

      try {
        const snapshot = await getDoc(
          doc(db, "users", user.uid)
        );

        const materialsSnapshot = await getDocs(
          collection(db, "users", user.uid, "materialHistory")
        );

        const flashcardsSnapshot = await getDocs(
          collection(db, "users", user.uid, "flashcardHistory")
        );

        if (cancelled) return;

        const data = snapshot.exists()
          ? snapshot.data()
          : {};

        const materialHistory = materialsSnapshot.docs
          .map((historyDoc) => ({
            id: historyDoc.id,
            ...historyDoc.data(),
          }))
          .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

        const flashcardHistory = flashcardsSnapshot.docs
          .map((historyDoc) => ({
            id: historyDoc.id,
            ...historyDoc.data(),
          }))
          .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

        setDashboardMaterialsHistory(materialHistory);
        setDashboardFlashcardHistory(flashcardHistory);

        const totalMaterials = Number(data.totalMaterials || 0);
        const studySessions = Number(data.studySessions || 0);
        const completedQuizzes = Number(data.completedQuizzes || 0);
        const totalQuizScore = Number(data.totalQuizScore || 0);
        const flashcardsCreated = Number(data.flashcardsCreated || 0);

        setDashboardStats({
          totalMaterials,
          studySessions,
          completedQuizzes,
          totalQuizScore,
          averageQuizScore:
            completedQuizzes > 0
              ? Math.round(totalQuizScore / completedQuizzes)
              : 0,
          flashcardsCreated,
        });
      } catch (error) {
        console.error("Dashboard loading error:", error);
      } finally {
        if (!cancelled) {
          setDashboardLoading(false);
        }
      }
    };

    loadDashboardStats();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // ========================================================
  // TEST TIMER
  // ========================================================

  useEffect(() => {
    if (!testStarted || testFinished) return;

    if (testTimeLeft <= 0) {
      finishTest();
      return;
    }

    const timer = window.setInterval(() => {
      setTestTimeLeft((previous) => Math.max(previous - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [testStarted, testFinished, testTimeLeft]);

  // ========================================================
  // SCROLL LISTENER
  // ========================================================

  useEffect(() => {
    const handleScroll = () => {
      setShowGoUp(window.scrollY > 300);
    };

    window.addEventListener(
      "scroll",
      handleScroll
    );

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll
      );
    };
  }, []);

  // ========================================================
  // AUTO SCROLL CHAT
  // ========================================================

  useEffect(() => {
    if (!chatMessagesRef.current) {
      return;
    }

    chatMessagesRef.current.scrollTop =
      chatMessagesRef.current.scrollHeight;
  }, [chatMessages, chatLoading]);

  // ========================================================
  // STOP SPEECH ON UNMOUNT
  // ========================================================

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      oralRecognitionActiveRef.current = false;
      if (oralRecognitionRef.current) {
        try { oralRecognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  // ========================================================
  // GUESS THE WORD GAME HANDLERS
  // ========================================================

  const startGuessWordGame = () => {
    const randomWord = guessWordBank[Math.floor(Math.random() * guessWordBank.length)];
    setGuessWord(randomWord);
    setGuessedLetters([]);
    setGuessInput("");
    setGuessTries(randomWord.length * 2);
    setGuessGameStarted(true);
    setGuessGameStatus("playing");
    setGuessMessage("");
  };

  const handleRevealGuessWord = () => {
    if (!guessGameStarted || guessGameStatus !== "playing") return;

    setGuessTries(0);
    setGuessGameStatus("revealed");
    setGuessMessage(`👀 The secret word was "${guessWord}".`);
    setGuessedLetters([...new Set(guessWord.split(""))]);
    setGuessInput("");
  };


  // ========================================================
  // BALLOON LETTER GAME HANDLERS
  // ========================================================

  const createBalloonRound = () => {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    const target =
      alphabet[Math.floor(Math.random() * alphabet.length)];

    const wrongLetters = [];
    while (wrongLetters.length < 9) {
      const letter =
        alphabet[Math.floor(Math.random() * alphabet.length)];

      if (letter !== target && !wrongLetters.includes(letter)) {
        wrongLetters.push(letter);
      }
    }

    const roundLetters = [target, ...wrongLetters];

    // Create well-spaced horizontal positions so balloons do not
    // appear too close together.
    const positions = [5, 15, 25, 35, 45, 55, 65, 75, 85, 95];

    // Shuffle the balloon letters so the correct one is not predictable.
    for (let i = roundLetters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roundLetters[i], roundLetters[j]] = [
        roundLetters[j],
        roundLetters[i],
      ];
    }

    setBalloonTargetLetter(target);
    setBalloons(
      roundLetters.map((letter, index) => ({
        id: `${Date.now()}-${index}-${Math.random()}`,
        letter,
        left: positions[index],
        delay: Math.random() * 0.45,
        duration: 5 + Math.random() * 2,
        status: "falling",
      }))
    );
    setBalloonGameMessage("");
  };

  const startBalloonGame = () => {
    setBalloonScore(0);
    setBalloonGameStarted(true);
    setBalloonGameMessage("");
    createBalloonRound();
  };

  const closeBalloonGame = () => {
    setBalloonGameStarted(false);
    setBalloons([]);
    setBalloonTargetLetter("");
    setBalloonGameMessage("");
    setBalloonScore(0);
  };

  const handleBalloonClick = (balloon) => {
    if (!balloonGameStarted || balloon.status !== "falling") {
      return;
    }

    if (balloon.letter === balloonTargetLetter) {
      setBalloonScore((score) => score + 1);
      setBalloonGameMessage("🎉 Correct! +1");

      // Immediately begin the next round.
      setTimeout(() => {
        if (balloonGameStarted) {
          createBalloonRound();
        }
      }, 250);
    } else {
      setBalloons((current) =>
        current.map((item) =>
          item.id === balloon.id
            ? { ...item, status: "wrong" }
            : item
        )
      );
      setBalloonGameMessage("✕ Wrong balloon!");
    }
  };

  const handleBalloonRoundEnd = () => {
    if (!balloonGameStarted) {
      return;
    }

    setBalloonGameMessage("💨 The balloons reached the bottom!");

    // Generate a new target/round after the current round finishes.
    setTimeout(() => {
      if (balloonGameStarted) {
        createBalloonRound();
      }
    }, 350);
  };

  const handleGuessLetter = () => {
    const letter = guessInput.trim().toLowerCase();
    if (!guessGameStarted || guessGameStatus !== "playing") return;
    if (!/^[a-z]$/.test(letter)) {
      setGuessMessage("Enter one English letter (a-z).");
      setGuessInput("");
      return;
    }
    if (guessedLetters.includes(letter)) {
      setGuessMessage("You already tried that letter.");
      setGuessInput("");
      return;
    }
    const nextGuessedLetters = [...guessedLetters, letter];
    const nextTries = Math.max(guessTries - 1, 0);
    setGuessedLetters(nextGuessedLetters);
    setGuessTries(nextTries);
    setGuessInput("");
    if (guessWord.includes(letter)) {
      const solved = guessWord.split("").every((character) => nextGuessedLetters.includes(character));
      if (solved) {
        setGuessGameStatus("won");
        setGuessMessage("🎉 Success! You guessed the word!");
      } else {
        setGuessMessage("✓ Correct character!");
      }
      return;
    }
    if (nextTries <= 0) {
      setGuessGameStatus("lost");
      setGuessMessage(`😔 Game over! The word was "${guessWord}".`);
    } else {
      setGuessMessage(`✕ Wrong character. ${nextTries} tries left.`);
    }
  };

  const handleGuessInputKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleGuessLetter();
    }
  };

  // ========================================================
  // SCROLL TOP
  // ========================================================

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ========================================================
  // STOP SPEECH
  // ========================================================

  const stopSpeech = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // ========================================================
  // FIREBASE AUTHENTICATION HANDLERS
  // ========================================================

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError("");

    const isSignup = authView === "signup";
    const email = authForm.email.trim();
    const password = authForm.password;

    if (isSignup) {
      if (!authForm.name.trim()) {
        setAuthError("Please enter your full name.");
        return;
      }

      if (password !== authForm.confirmPassword) {
        setAuthError("Passwords do not match.");
        return;
      }
    }

    setAuthLoading(true);

    try {
      if (isSignup) {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        const firebaseUser = credential.user;
        const displayName = authForm.name.trim();

        await updateProfile(firebaseUser, {
          displayName,
        });

        await setDoc(
          doc(db, "users", firebaseUser.uid),
          {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName,
            totalMaterials: 0,
            studySessions: 0,
            completedQuizzes: 0,
            totalQuizScore: 0,
            flashcardsCreated: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        setUser(firebaseUser);
        setAuthView("app");
      } else {
        const credential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        setUser(credential.user);
        setAuthView("app");
      }

      setAuthForm({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      setAuthError("");
    } catch (error) {
      console.error("Firebase authentication error:", error);

      switch (error.code) {
        case "auth/email-already-in-use":
          setAuthError("This email is already registered.");
          break;
        case "auth/invalid-email":
          setAuthError("Please enter a valid email address.");
          break;
        case "auth/weak-password":
          setAuthError("Password should be at least 6 characters.");
          break;
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          setAuthError("Invalid email or password.");
          break;
        case "auth/network-request-failed":
          setAuthError(
            "Failed: Check your Firebase configuration and internet connection."
          );
          break;
        case "auth/operation-not-allowed":
          setAuthError(
            "Email/password sign-in is not enabled in Firebase Authentication."
          );
          break;
        default:
          setAuthError(error.message || "Authentication failed.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setAuthError("");

    const email = authForm.email.trim();

    if (!email) {
      setAuthError("Enter your email address first.");
      return;
    }

    setAuthLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setAuthError("Password reset email sent. Check your inbox.");
    } catch (error) {
      console.error("Password reset error:", error);

      if (error.code === "auth/user-not-found") {
        setAuthError("No account was found with this email.");
      } else if (error.code === "auth/invalid-email") {
        setAuthError("Please enter a valid email address.");
      } else {
        setAuthError(error.message || "Could not send the reset email.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const openAuth = (view) => {
    setAuthError("");
    setAuthView(view);
  };

  const handleLogout = async () => {
    setMobileMenuOpen(false);

    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }

    setUser(null);
    setAuthView("welcome");
    setAuthForm({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
    setAuthError("");

    setText("");
    setFile(null);
    setFiles([]);
    setMaterialReady(false);
    setResult("");
    setResultLanguage("");
    setFlashcards([]);
    setFlashcardIndex(0);
    setFlashcardFlipped(false);
    setChatMessages([]);
    setChatQuestion("");
    setChatOpen(false);
    setTestQuestions([]);
    setTestAnswers({});
    setTestStarted(false);
    setTestFinished(false);
    setTestScore(0);
    setDashboardStats({
      totalMaterials: 0,
      studySessions: 0,
      completedQuizzes: 0,
      totalQuizScore: 0,
      averageQuizScore: 0,
      flashcardsCreated: 0,
    });
    setDashboardMaterialsHistory([]);
    setDashboardFlashcardHistory([]);
    setDashboardHistoryType(null);
    testSubmissionRecordedRef.current = false;
    stopSpeech();
  };

  // ========================================================
  // DASHBOARD HISTORY HANDLERS
  // ========================================================

  const toggleDashboardHistory = (type) => {
    setDashboardHistoryType((previous) =>
      previous === type ? null : type
    );
  };

  const closeDashboardHistory = () => {
    setDashboardHistoryType(null);
  };

  const openPreviousFlashcards = (historyItem) => {
    if (!Array.isArray(historyItem?.cards) || !historyItem.cards.length) {
      return;
    }

    setFlashcards(historyItem.cards);
    setFlashcardIndex(0);
    setFlashcardFlipped(false);
    setDashboardHistoryType(null);

    setTimeout(() => {
      document
        .getElementById("flashcards-section")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 100);
  };

  // ========================================================
  // PROCESS MULTIPLE FILES
  // ========================================================

  const processFiles = async (selectedFiles) => {
    const validFiles = Array.from(selectedFiles || []).filter(Boolean);

    if (!validFiles.length) {
      return;
    }

    if (validFiles.length > 10) {
      alert("Please select a maximum of 10 files at a time.");
      return;
    }

    setProcessing(true);
    setFiles(validFiles);
    setFile(validFiles[0]);
    setResult("");
    setResultLanguage("");
    setMaterialReady(false);
    setFlashcards([]);
    setFlashcardIndex(0);
    setFlashcardFlipped(false);

    setChatMessages([]);
    setChatQuestion("");

    stopSpeech();

    try {
      const formData = new FormData();

      validFiles.forEach((selectedFile) => {
        formData.append("files", selectedFile);
      });

      const data = await apiRequest(
        "/api/material",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!data.success) {
        throw new Error(
          data.error ||
            "Could not process the selected files."
        );
      }

      setMaterialReady(true);

      // Save this user's material and study-session activity.
      if (user?.uid) {
        const userRef = doc(db, "users", user.uid);

        await setDoc(
          userRef,
          {
            totalMaterials: increment(validFiles.length),
            studySessions: increment(1),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        setDashboardStats((previous) => ({
          ...previous,
          totalMaterials: previous.totalMaterials + validFiles.length,
          studySessions: previous.studySessions + 1,
        }));

        try {
          const materialHistoryItem = {
            fileNames: validFiles.map((selectedFile) => selectedFile.name),
            createdAt: Date.now(),
          };

          const historyDoc = await addDoc(
            collection(db, "users", user.uid, "materialHistory"),
            materialHistoryItem
          );

          setDashboardMaterialsHistory((previous) => [
            {
              id: historyDoc.id,
              ...materialHistoryItem,
            },
            ...previous,
          ]);
        } catch (historyError) {
          console.error("Could not save material history:", historyError);
        }
      }

    } catch (error) {
      console.error(
        "File processing error:",
        error
      );

      alert(
        error.message ||
          "Could not process the uploaded files."
      );

      setFiles([]);
      setFile(null);
      setMaterialReady(false);

    } finally {
      setProcessing(false);
    }
  };

  // Keep the single-file helper for the camera workflow.
  const processFile = async (selectedFile) => {
    if (!selectedFile) {
      return;
    }

    await processFiles([selectedFile]);
  };

  // ========================================================
  // CAMERA CAPTURE
  // ========================================================

  const handleCameraCapture = (event) => {
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setText("");

    processFile(selectedFile);

    event.target.value = "";
  };

  // ========================================================
  // OPEN CAMERA
  // ========================================================

  const openCamera = () => {
    if (processing) {
      return;
    }

    cameraInputRef.current?.click();
  };

  // ========================================================
  // FILE SELECTION
  // ========================================================

  const handleFileChange = (event) => {
    const selectedFiles = Array.from(
      event.target.files || []
    );

    if (!selectedFiles.length) {
      return;
    }

    setText("");

    processFiles(selectedFiles);

    // Allow selecting the same files again later.
    event.target.value = "";
  };

  // ========================================================
  // PROCESS PASTED TEXT
  // ========================================================

  const processPastedText = async () => {
    if (!text.trim()) {
      alert(
        "Please paste your study material first."
      );

      return false;
    }

    setProcessing(true);
    setResult("");
    setResultLanguage("");
    setFlashcards([]);
    setFlashcardIndex(0);
    setFlashcardFlipped(false);

    setChatMessages([]);
    setChatQuestion("");

    stopSpeech();

    try {
      const data = await apiRequest(
        "/api/material",
        {
          method: "POST",

          body: JSON.stringify({
            text: text.trim(),
          }),
        }
      );

      if (!data.success) {
        throw new Error(
          data.error ||
            "Could not process the study material."
        );
      }

      setMaterialReady(true);

      return true;

    } catch (error) {
      console.error(
        "Text processing error:",
        error
      );

      alert(
        error.message ||
          "Could not process the study material."
      );

      return false;

    } finally {
      setProcessing(false);
    }
  };

  // ========================================================
  // GENERATE FLASHCARDS
  // ========================================================

  const handleGenerateFlashcards = async () => {
    setFlashcardsLoading(true);
    setResult("");

    stopSpeech();

    try {
      let ready = materialReady;

      // Automatically process pasted text
      if (!ready && text.trim()) {
        const processed = await processPastedText();

        if (!processed) {
          setFlashcardsLoading(false);
          return;
        }

        ready = true;
      }

      if (!ready && !file && !text.trim()) {
        alert(
          "Please upload a document/image or paste your study material."
        );

        setFlashcardsLoading(false);
        return;
      }

      const data = await apiRequest(
        "/api/flashcards",
        {
          method: "POST",
          body: JSON.stringify({
            count: 10,
          }),
        }
      );

      if (!data.success || !Array.isArray(data.cards)) {
        throw new Error(
          data.error || "Could not generate flashcards."
        );
      }

      setFlashcards(data.cards);
      setFlashcardIndex(0);
      setFlashcardFlipped(false);

      // Save generated flashcards for the current user.
      if (user?.uid) {
        const createdCount = data.cards.length;
        const userRef = doc(db, "users", user.uid);

        await setDoc(
          userRef,
          {
            flashcardsCreated: increment(createdCount),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        setDashboardStats((previous) => ({
          ...previous,
          flashcardsCreated: previous.flashcardsCreated + createdCount,
        }));

        const sourceFileNames = files.length
          ? files.map((selectedFile) => selectedFile.name)
          : file?.name
            ? [file.name]
            : ["Pasted study material"];

        const flashcardHistoryItem = {
          cards: data.cards,
          fileNames: sourceFileNames,
          createdAt: Date.now(),
        };

        try {
          const historyDoc = await addDoc(
            collection(db, "users", user.uid, "flashcardHistory"),
            flashcardHistoryItem
          );

          setDashboardFlashcardHistory((previous) => [
            {
              id: historyDoc.id,
              ...flashcardHistoryItem,
            },
            ...previous,
          ]);
        } catch (historyError) {
          console.error("Could not save flashcard history:", historyError);
        }
      }

      setTimeout(() => {
        document
          .getElementById("flashcards-section")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 100);

    } catch (error) {
      console.error(
        "Flashcards error:",
        error
      );

      alert(
        error.message ||
          "Could not generate flashcards."
      );

    } finally {
      setFlashcardsLoading(false);
    }
  };

  const handleNextFlashcard = () => {
    setFlashcardFlipped(false);

    setFlashcardIndex((previous) =>
      Math.min(
        previous + 1,
        flashcards.length - 1
      )
    );
  };

  const handlePreviousFlashcard = () => {
    setFlashcardFlipped(false);

    setFlashcardIndex((previous) =>
      Math.max(previous - 1, 0)
    );
  };

  const handleFlipFlashcard = () => {
    setFlashcardFlipped((previous) => !previous);
  };

  // ========================================================
  // TEST CONCEPTS
  // ========================================================

  const formatTestTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  const calculateTestScore = () => {
    return testQuestions.reduce((score, question, index) => {
      return score + (testAnswers[index] === question.answer ? 1 : 0);
    }, 0);
  };

  const finishTest = async () => {
    // Prevent duplicate counting from rapid clicks or timer/submission overlap.
    if (testFinished || testSubmissionRecordedRef.current) {
      return;
    }

    testSubmissionRecordedRef.current = true;

    const score = calculateTestScore();
    const totalQuestions = testQuestions.length;
    const percentage =
      totalQuestions > 0
        ? Math.round((score / totalQuestions) * 100)
        : 0;

    setTestScore(score);
    setTestFinished(true);
    setTestStarted(false);
    setTestIndex(0);

    if (user?.uid && totalQuestions > 0) {
      try {
        const userRef = doc(db, "users", user.uid);

        await setDoc(
          userRef,
          {
            completedQuizzes: increment(1),
            totalQuizScore: increment(percentage),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        setDashboardStats((previous) => {
          const completedQuizzes = previous.completedQuizzes + 1;
          const totalQuizScore = previous.totalQuizScore + percentage;

          return {
            ...previous,
            completedQuizzes,
            totalQuizScore,
            averageQuizScore: Math.round(
              totalQuizScore / completedQuizzes
            ),
          };
        });
      } catch (error) {
        console.error("Could not save quiz statistics:", error);
      }
    }
  };

  const handleGenerateTest = async () => {
    setTestLoading(true);
    setResult("");
    stopSpeech();

    try {
      let ready = materialReady;

      if (!ready && text.trim()) {
        const processed = await processPastedText();
        if (!processed) return;
        ready = true;
      }

      if (!ready && files.length === 0 && !file && !text.trim()) {
        alert("Please upload study material or paste your content first.");
        return;
      }

      const data = await apiRequest("/api/test-concepts", {
        method: "POST",
        body: JSON.stringify({ count: 20 }),
      });

      if (!data.success || !Array.isArray(data.questions) || !data.questions.length) {
        throw new Error(data.error || "Could not generate the test.");
      }

      setTestQuestions(data.questions);
      setTestAnswers({});
      setTestIndex(0);
      setTestScore(0);
      setTestFinished(false);
      testSubmissionRecordedRef.current = false;
      setTestTotalSeconds(data.duration_seconds || data.questions.length * 60);
      setTestTimeLeft(data.duration_seconds || data.questions.length * 60);
      setTestStarted(false);

      setTimeout(() => {
        document.getElementById("test-concepts-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (error) {
      console.error("Test concepts error:", error);
      alert(error.message || "Could not generate the test.");
    } finally {
      setTestLoading(false);
    }
  };

  const startTest = () => {
    setTestAnswers({});
    setTestIndex(0);
    setTestScore(0);
    setTestFinished(false);
    testSubmissionRecordedRef.current = false;
    setTestTimeLeft(testTotalSeconds);
    setTestStarted(true);
  };

  const selectTestAnswer = (option) => {
    if (testFinished || !testStarted) return;
    setTestAnswers((previous) => ({
      ...previous,
      [testIndex]: option,
    }));
  };

  const nextTestQuestion = () => {
    if (testIndex >= testQuestions.length - 1) {
      finishTest();
      return;
    }
    setTestIndex((previous) => previous + 1);
  };

  // ========================================================
  // AI ORAL EXAM
  // ========================================================

  const oralSpeechLang = (language) =>
    language === "urdu" ? "ur-PK" :
    language === "arabic" ? "ar-SA" : "en-US";

  const speakOralText = (value, language, onDone) => {
    if (!("speechSynthesis" in window)) {
      onDone?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = oralSpeechLang(language);
    utterance.rate = 0.92;
    utterance.onend = () => onDone?.();
    utterance.onerror = () => onDone?.();
    window.speechSynthesis.speak(utterance);
  };

  const startOralListening = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setOralExam(p => ({ ...p, supported: false, status: "unsupported" }));
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }
    if (!oralExam.active || !oralExam.sessionId || oralRecognitionActiveRef.current) return;
    try {
      const recognition = new Recognition();
      recognition.lang = oralSpeechLang(oralExam.language);
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;
      oralRecognitionRef.current = recognition;
      oralRecognitionActiveRef.current = true;
      setOralExam(p => ({ ...p, listening: true, status: "listening", feedback: "" }));

      recognition.onresult = async (event) => {
        const answer = event.results?.[0]?.[0]?.transcript?.trim();
        oralRecognitionActiveRef.current = false;
        if (!answer) {
          setOralExam(p => ({ ...p, listening: false, status: "waiting" }));
          return;
        }
        setOralExam(p => ({ ...p, listening: false, status: "evaluating" }));
        try {
          const data = await apiRequest("/api/oral-exam", {
            method: "POST",
            body: JSON.stringify({ action: "evaluate", session_id: oralExam.sessionId, answer })
          });
          if (!data.success) throw new Error(data.error || "Could not evaluate your answer.");
          setOralExam(p => ({
            ...p,
            question: data.next_question || "",
            questionNumber: data.question_number || p.questionNumber,
            totalQuestions: data.total_questions || p.totalQuestions,
            score: typeof data.score === "number" ? data.score : p.score,
            feedback: data.feedback || "",
            status: data.completed ? "completed" : "feedback",
            active: !data.completed
          }));
          if (data.completed) {
            speakOralText(data.final_message || `Oral test complete. Your score is ${data.score} out of ${data.total_questions}.`, oralExam.language);
            return;
          }
          speakOralText(data.feedback || "Your answer has been evaluated.", oralExam.language, () => {
            setTimeout(() => speakOralText(data.next_question, oralExam.language, () => setTimeout(startOralListening, 350)), 500);
          });
        } catch (error) {
          console.error("Oral exam evaluation error:", error);
          setOralExam(p => ({ ...p, listening: false, status: "error" }));
          alert(error.message || "Could not evaluate your spoken answer.");
        }
      };
      recognition.onerror = (event) => {
        oralRecognitionActiveRef.current = false;
        if (["aborted", "no-speech"].includes(event.error)) {
          setOralExam(p => ({ ...p, listening: false, status: "waiting" }));
          return;
        }
        setOralExam(p => ({ ...p, listening: false, status: "error" }));
      };
      recognition.onend = () => {
        oralRecognitionActiveRef.current = false;
        setOralExam(p => ({ ...p, listening: false }));
      };
      recognition.start();
    } catch (error) {
      oralRecognitionActiveRef.current = false;
      setOralExam(p => ({ ...p, listening: false, status: "error" }));
    }
  };

  const handleStartOralExam = async () => {
    setGenerating(true);
    setResult("");
    stopSpeech();
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setGenerating(false);
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }
    try {
      let ready = materialReady;
      if (!ready && text.trim()) {
        const processed = await processPastedText();
        if (!processed) return;
        ready = true;
      }
      if (!ready && files.length === 0 && !file && !text.trim()) {
        alert("Please upload study material or paste your content first.");
        return;
      }
      const data = await apiRequest("/api/oral-exam", { method: "POST", body: JSON.stringify({ action: "start" }) });
      if (!data.success) throw new Error(data.error || "Could not start the oral test.");
      setOralExam({ active:true, sessionId:data.session_id, question:data.question, questionNumber:data.question_number||1, totalQuestions:data.total_questions||10, language:data.language||"english", status:"asking", feedback:"", score:0, listening:false, supported:true });
      setTimeout(() => document.getElementById("oral-exam-section")?.scrollIntoView({ behavior:"smooth", block:"start" }), 100);
      speakOralText(data.question, data.language || "english", () => setTimeout(startOralListening, 450));
    } catch (error) {
      console.error("Oral exam start error:", error);
      alert(error.message || "Could not start the oral test.");
    } finally { setGenerating(false); }
  };

  const handleRepeatOralQuestion = () => {
    if (!oralExam.active || !oralExam.question || oralExam.listening) return;
    speakOralText(oralExam.question, oralExam.language, () => setTimeout(startOralListening, 350));
  };

  const handleStopOralExam = () => {
    oralRecognitionActiveRef.current = false;
    try { oralRecognitionRef.current?.abort(); } catch {}
    window.speechSynthesis?.cancel();
    setOralExam(p => ({ ...p, active:false, listening:false, status:"idle" }));
  };

  // ========================================================
  // GENERATE RESULT
  // ========================================================

  const handleGenerate = async () => {
    if (mode === "flashcards") {
      await handleGenerateFlashcards();
      return;
    }

    if (mode === "test") {
      await handleGenerateTest();
      return;
    }

    if (mode === "oral") {
      await handleStartOralExam();
      return;
    }

    setGenerating(true);
    setResult("");

    stopSpeech();

    try {
      let ready = materialReady;

      // Automatically process pasted text
      if (!ready && text.trim()) {
        const processed =
          await processPastedText();

        if (!processed) {
          setGenerating(false);
          return;
        }

        ready = true;
      }

      // No material
      if (
        !ready &&
        !file &&
        !text.trim()
      ) {
        alert(
          "Please upload a document/image or paste your study material."
        );

        setGenerating(false);

        return;
      }

      // Generate result
      const data = await apiRequest(
        "/api/generate",
        {
          method: "POST",

          body: JSON.stringify({
            mode: mode,
          }),
        }
      );

      if (!data.success) {
        throw new Error(
          data.error ||
            "Could not generate the result."
        );
      }

      setResult(
        data.result || ""
      );

      setResultLanguage(
        data.language || "english"
      );

      setTimeout(() => {
        document
          .getElementById(
            "result-section"
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 100);

    } catch (error) {
      console.error(
        "Generate error:",
        error
      );

      alert(
        error.message ||
          "Could not generate the result."
      );

    } finally {
      setGenerating(false);
    }
  };

  // ========================================================
  // COPY RESULT
  // ========================================================

  const handleCopy = async () => {
    if (!result) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        result
      );

      alert(
        "Result copied to clipboard!"
      );

    } catch (error) {
      console.error(error);

      alert(
        "Could not copy the result."
      );
    }
  };

  // ========================================================
  // DOWNLOAD PDF
  // ========================================================

  const handleDownloadPDF = async () => {
    if (!result) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/generate-pdf`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            result: result,
            mode: mode,
            language: resultLanguage,
          }),
        }
      );

      if (!response.ok) {
        let errorMessage =
          "Could not generate PDF.";

        try {
          const data =
            await response.json();

          errorMessage =
            data.error ||
            data.message ||
            errorMessage;
        } catch {
          // Server did not return JSON
        }

        throw new Error(
          errorMessage
        );
      }

      const blob =
        await response.blob();

      const url =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        `studyflow_${mode}.pdf`;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      window.URL.revokeObjectURL(
        url
      );

    } catch (error) {
      console.error(
        "PDF error:",
        error
      );

      alert(
        error.message ||
          "Could not download the PDF."
      );
    }
  };

  // ========================================================
  // READ RESULT ALOUD
  // ========================================================

  const handleReadAloud = () => {
    if (!result) {
      return;
    }

    if (
      !("speechSynthesis" in window)
    ) {
      alert(
        "Text-to-Speech is not supported in this browser."
      );

      return;
    }

    if (isSpeaking) {
      stopSpeech();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        result
      );

    // Select language
    if (
      resultLanguage === "arabic"
    ) {
      utterance.lang = "ar-SA";
    } else if (
      resultLanguage === "urdu"
    ) {
      utterance.lang = "ur-PK";
    } else {
      utterance.lang = "en-US";
    }

    const voices =
      window.speechSynthesis.getVoices();

    let languagePrefix = "en";

    if (
      resultLanguage === "arabic"
    ) {
      languagePrefix = "ar";
    } else if (
      resultLanguage === "urdu"
    ) {
      languagePrefix = "ur";
    }

    // Try female voice first
    const femaleVoice =
      voices.find((voice) => {
        const language =
          voice.lang?.toLowerCase() ||
          "";

        const name =
          voice.name?.toLowerCase() ||
          "";

        return (
          language.startsWith(
            languagePrefix
          ) &&
          (
            name.includes("female") ||
            name.includes("zira") ||
            name.includes("samantha") ||
            name.includes("susan") ||
            name.includes("hazel") ||
            name.includes("aria") ||
            name.includes("jenny")
          )
        );
      });

    // Otherwise use matching language voice
    const languageVoice =
      voices.find((voice) =>
        voice.lang
          ?.toLowerCase()
          .startsWith(
            languagePrefix
          )
      );

    if (femaleVoice) {
      utterance.voice =
        femaleVoice;
    } else if (languageVoice) {
      utterance.voice =
        languageVoice;
    }

    utterance.rate = 0.88;
    utterance.pitch = 1.15;
    utterance.volume = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(
      utterance
    );
  };

  // ========================================================
  // OPEN / CLOSE CHATBOT
  // ========================================================

  const toggleChat = () => {
    setChatOpen(
      (previous) => !previous
    );
  };

  // ========================================================
  // CHAT SUBMIT
  // ========================================================
const trackFeatureUsage = async (featureName) => {
  if (!user?.uid) return;

  try {
    await setDoc(
      doc(db, "users", user.uid),
      {
        [`featureUsage.${featureName}`]: increment(1),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error(
      `Could not save ${featureName} usage:`,
      error
    );
  }
};
  const handleChatSubmit =
    async (event) => {
      event.preventDefault();

      const question =
        chatQuestion.trim();

      if (!question) {
        return;
      }

      // Make sure material exists
      let ready = materialReady;

      if (
        !ready &&
        text.trim()
      ) {
        const processed =
          await processPastedText();

        if (!processed) {
          return;
        }

        ready = true;
      }

      if (!ready) {
        setChatMessages(
          (previous) => [
            ...previous,

            {
              role: "assistant",

              content:
                "Please upload or paste your study material first.",
            },
          ]
        );

        return;
      }

      // Save user message
      const previousMessages =
        chatMessages;

      const newUserMessage = {
        role: "user",
        content: question,
      };

      setChatMessages(
        (previous) => [
          ...previous,
          newUserMessage,
        ]
      );

      setChatQuestion("");
      setChatLoading(true);

      try {
        // Only send recent messages
        const history =
          previousMessages
            .slice(-8)
            .map((message) => ({
              role: message.role,
              content: message.content,
            }));

        const data =
          await apiRequest(
            "/api/chat",
            {
              method: "POST",

              body: JSON.stringify({
                question:
                  question,

                history:
                  history,
              }),
            }
          );

        if (!data.success) {
          setChatMessages(
            (previous) => [
              ...previous,

              {
                role:
                  "assistant",

                content:
                  data.error ||
                  "Could not answer the question.",
              },
            ]
          );

          return;
        }

        setChatMessages(
          (previous) => [
            ...previous,

            {
              role:
                "assistant",

              content:
                data.answer ||
                "I could not generate an answer.",

              language:
                data.language ||
                "english",
            },
          ]
        );

      } catch (error) {
        console.error(
          "Chat error:",
          error
        );

        setChatMessages(
          (previous) => [
            ...previous,

            {
              role:
                "assistant",

              content:
                error.message ||
                "Could not connect to the AI chatbot.",
            },
          ]
        );

      } finally {
        setChatLoading(false);
      }
    };


  // ========================================================
  // USER RANK / LEVEL
  // ========================================================

  const RANK_LEVELS = [
    { level: 0, name: "Beginner", icon: "🔰", sessions: 0, materials: 0 },
    { level: 1, name: "Learner", icon: "📚", sessions: 50, materials: 50 },
    { level: 2, name: "Scholar", icon: "🧠", sessions: 150, materials: 100 },
    { level: 3, name: "Dedicated", icon: "🎯", sessions: 300, materials: 200 },
    { level: 4, name: "Expert", icon: "🔥", sessions: 500, materials: 350 },
    { level: 5, name: "Master", icon: "✨", sessions: 750, materials: 500 },
    { level: 6, name: "Grand Master", icon: "👑", sessions: 1000, materials: 750 },
    { level: 7, name: "Elite", icon: "💎", sessions: 1500, materials: 1000 },
    { level: 8, name: "Legend", icon: "⚡", sessions: 2500, materials: 1500 },
  ];

  const currentRank =
    [...RANK_LEVELS].reverse().find(
      (rank) =>
        dashboardStats.studySessions >= rank.sessions &&
        dashboardStats.totalMaterials >= rank.materials
    ) || RANK_LEVELS[0];

  const nextRank = RANK_LEVELS.find(
    (rank) => rank.level === currentRank.level + 1
  ) || null;

  const rankProgress = nextRank
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            Math.min(
              dashboardStats.studySessions / nextRank.sessions,
              dashboardStats.totalMaterials / nextRank.materials
            ) * 100
          )
        )
      )
    : 100;

  // ========================================================
  // AUTH GATE
  // ========================================================

  if (!authChecked) {
    return (
      <div className="auth-loading-screen">
        <img src="/favicon.png" alt="StudyFlow AI" />
        <span>Loading StudyFlow AI...</span>
      </div>
    );
  }

  if (!user) {
    if (authView === "login" || authView === "signup") {
      return (
        <AuthPage
          mode={authView}
          onModeChange={openAuth}
          onSubmit={handleAuthSubmit}
          onForgotPassword={handleForgotPassword}
          loading={authLoading}
          error={authError}
          form={authForm}
          setForm={setAuthForm}
        />
      );
    }

    return (
      <WelcomePage
        onLogin={() => openAuth("login")}
        onSignup={() => openAuth("signup")}
      />
    );
  }

  // ========================================================
  // UI
  // ========================================================

  return (
    <div className="app">

      {/* ==================================================
          LOGGED-IN NAVBAR
          Desktop: logo + navigation + account
          Mobile: logo + hamburger menu
      ================================================== */}

      <header className="app-navbar">
        <a
          className="brand-mark"
          href="#heroclass"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="StudyFlow AI home"
        >
          <img src="/favicon.png" alt="StudyFlow AI logo" />
          <span>StudyFlow AI</span>
        </a>

        <nav
          id="studyflow-mobile-navigation"
          className={`app-nav-links ${mobileMenuOpen ? "mobile-open" : ""}`}
          aria-label="Main navigation"
        >
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setShowDashboard(true);
              document.getElementById("dashboard-section")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          >
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              document.getElementById("inputcard")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          >
            Upload material
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("flashcards");
              setMobileMenuOpen(false);
              document.getElementById("action-section")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          >
            Flashcards
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              document.getElementById("action-section")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          >
            Quiz &amp; AI
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("test");
              setMobileMenuOpen(false);
              document.getElementById("action-section")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          >
            Test Concepts
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setGamesOpen(true);
            }}
          >
            Games Fun
          </button>

          <div className="mobile-account-block">
            <span>
              👤 {user.displayName || user.email || "Account"}
            </span>
            <button
              type="button"
              className="mobile-logout-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </nav>

        <div className="app-nav-user desktop-nav-user">
          <div className="user-pill">
            <span aria-hidden="true">👤</span>
            <strong title={user.displayName || user.email || "Account"}>
              {user.displayName || user.email || "Account"}
            </strong>
          </div>

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>

        <button
          type="button"
          className="navbar-menu-button"
          onClick={() => setMobileMenuOpen((previous) => !previous)}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="studyflow-mobile-navigation"
        >
          <span />
          <span />
          <span />
        </button>
      </header>

     <section
  id="dashboard-section"
  className="dashboard-section">
  <div
    className="dashboard-heading">
    <span className="section-kicker">YOUR DASHBOARD</span>

    <h2>
      {user?.displayName
        ? `Welcome back, ${user.displayName}`
        : "Welcome back"}
    </h2>
  </div>

  {showDashboard && (
    <div className="dashboard-panel">
      {dashboardLoading ? (
        <div className="dashboard-loading">
          Loading your dashboard...
        </div>
      ) : (
        <>
      <div className="dashboard-stats-grid">
        {[
          {
            title: "Total Materials",
            value: dashboardStats.totalMaterials,
            text: "Files uploaded",
            icon: "📄",
            historyType: "materials",
          },
          {
            title: "Study Sessions",
            value: dashboardStats.studySessions,
            text: "Learning features",
            icon: "📚",
          },
          {
            title: "Completed Quizzes",
            value: dashboardStats.completedQuizzes,
            text: "Quizzes completed",
            icon: "📝",
          },
          {
            title: "Average Quiz Score",
            value: `${dashboardStats.averageQuizScore}%`,
            text: "Across all quizzes",
            icon: "📈",
          },
          {
            title: "Flashcards Created",
            value: dashboardStats.flashcardsCreated,
            text: "Concepts to remember",
            icon: "🗂️",
            historyType: "flashcards",
          },
          {
            title: `Level ${currentRank.level} • ${currentRank.name}`,
            value: currentRank.icon,
            text: nextRank
              ? `${rankProgress}% to Level ${nextRank.level}`
              : "Maximum rank reached",
            icon: "🏆",
            rankCard: true,
          },
        ].map((stat) => (
          <div
            key={stat.title}
            className={
              stat.rankCard
                ? "dashboard-stat-card dashboard-rank-card"
                : stat.historyType
                  ? "dashboard-stat-card dashboard-stat-card-clickable"
                  : "dashboard-stat-card"
            }
            role={stat.historyType ? "button" : undefined}
            tabIndex={stat.historyType ? 0 : undefined}
            onClick={
              stat.historyType
                ? () => toggleDashboardHistory(stat.historyType)
                : undefined
            }
            onKeyDown={
              stat.historyType
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleDashboardHistory(stat.historyType);
                    }
                  }
                : undefined
            }
          >
            <div className="dashboard-stat-top">
              <h3>{stat.title}</h3>

              <span
                aria-hidden="true"
                className="dashboard-stat-icon"
              >
                {stat.icon}
              </span>
            </div>

            <strong>{stat.value}</strong>

            <p>{stat.text}</p>

            {stat.rankCard && nextRank && (
              <div className="dashboard-rank-progress">
                <div className="dashboard-rank-progress-track">
                  <span style={{ width: `${rankProgress}%` }} />
                </div>
                <small>
                  {dashboardStats.studySessions}/{nextRank.sessions} sessions • {dashboardStats.totalMaterials}/{nextRank.materials} materials
                </small>
              </div>
            )}

            {stat.historyType && (
              <small className="dashboard-card-hint">
                {dashboardHistoryType === stat.historyType
                  ? "Click to close"
                  : "Click to view history"}
              </small>
            )}
          </div>
        ))}
      </div>

      {dashboardHistoryType && (
        <div className="dashboard-history-panel">
          <div className="dashboard-history-header">
            <div>
              <h3>
                {dashboardHistoryType === "materials"
                  ? "Uploaded Materials"
                  : "Previous Flashcard Sets"}
              </h3>
              <p>
                {dashboardHistoryType === "materials"
                  ? "Files uploaded by your account."
                  : "Flashcards generated from your previous study sessions."}
              </p>
            </div>

            <button
              type="button"
              className="dashboard-history-close"
              onClick={closeDashboardHistory}
              aria-label="Close dashboard history"
            >
              ✕
            </button>
          </div>

          {dashboardHistoryType === "materials" ? (
            dashboardMaterialsHistory.length > 0 ? (
              <ul className="dashboard-material-list">
                {dashboardMaterialsHistory.flatMap((historyItem, historyIndex) =>
                  (Array.isArray(historyItem.fileNames) ? historyItem.fileNames : []).map(
                    (fileName, fileIndex) => (
                      <li key={`${historyItem.id}-${historyIndex}-${fileIndex}`}>
                        <span aria-hidden="true">📄</span>
                        <span>{fileName}</span>
                      </li>
                    )
                  )
                )}
              </ul>
            ) : (
              <p className="dashboard-history-empty">
                No uploaded files found yet.
              </p>
            )
          ) : dashboardFlashcardHistory.length > 0 ? (
            <div className="dashboard-flashcard-history">
              {dashboardFlashcardHistory.map((historyItem, index) => (
                <div
                  className="dashboard-flashcard-history-item"
                  key={historyItem.id || index}
                >
                  <div className="dashboard-flashcard-history-info">
                    <strong>
                      Flashcard Set {dashboardFlashcardHistory.length - index}
                    </strong>
                    <span>
                      {Array.isArray(historyItem.cards)
                        ? `${historyItem.cards.length} cards`
                        : "Flashcards"}
                    </span>
                    <small>
                      Files: {
                        Array.isArray(historyItem.fileNames) && historyItem.fileNames.length
                          ? historyItem.fileNames.join(", ")
                          : "Pasted study material"
                      }
                    </small>
                  </div>

                  <button
                    type="button"
                    className="dashboard-history-open"
                    onClick={() => openPreviousFlashcards(historyItem)}
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-history-empty">
              No previous flashcard sets found yet.
            </p>
          )}
        </div>
          )}
        </>
      )}

      <button
        type="button"
        className="dashboard-close-btn"
        onClick={() => {
          setShowDashboard(false);
          closeDashboardHistory();
        }}
        aria-label="Close dashboard"
      >
        ×
      </button>
    </div>
  )}
</section>

      <main className="container">

       
        {/* =================================================
            HERO
        ================================================= */}

        <section className="hero" id="heroclass">

          <h1>
            Study smarter,
            <br />

            <span className="spann">
              Understand faster.
            </span>
          </h1>

          <p>
            Upload your study material or paste
            your notes, then let AI help you learn.
          </p>

        </section>

        {/* =================================================
            MATERIAL INPUT
        ================================================= */}

        <section
          className="input-card"
          id="inputcard"
        >

          <div className="card-header">

            <h2>
              Study Material
            </h2>

            <p>
              Paste your notes or upload a
              document or image.
            </p>

          </div>

          {/* TEXTAREA */}

          <textarea
            value={text}
            onChange={(event) => {
              setText(
                event.target.value
              );

              setFile(null);
              setFiles([]);
              setMaterialReady(false);
              setResult("");
              setResultLanguage("");
              setFlashcards([]);
              setFlashcardIndex(0);
              setFlashcardFlipped(false);

              setChatMessages([]);
              setChatQuestion("");

              stopSpeech();
            }}
            placeholder="Paste your study material here..."
          />

          {/* DIVIDER */}

          <div className="divider">
            <span>
              OR
            </span>
          </div>

          {/* UPLOAD */}

          <label className="upload-box">

            <span className="upload-icon">
              📄
            </span>

            <strong>
              {processing
                ? "Processing selected files..."
                : "Upload your documents or images"}
            </strong>

            <small>
              Select multiple PDF, DOCX, PPTX,
              JPG, PNG, WEBP, HEIC or HEIF files
            </small>

            <input
              type="file"
              multiple
              accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg,.webp,.heic,.heif"
              onChange={
                handleFileChange
              }
              disabled={processing}
            />

          </label>

          {/* MOBILE CAMERA */}

          <div className="camera-upload">

            <button
              type="button"
              className="camera-button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openCamera();
              }}
              disabled={processing}
              title="Take a photo"
              aria-label="Take a photo"
            >

              <svg
                className="camera-svg"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >

                <path
                  className="camera-corner"
                  d="M12 30V12H30"
                />

                <path
                  className="camera-corner"
                  d="M70 12H88V30"
                />

                <path
                  className="camera-corner"
                  d="M12 70V88H30"
                />

                <path
                  className="camera-corner"
                  d="M70 88H88V70"
                />

                <path
                  className="camera-body"
                  d="M25 38H34L39 30H61L66 38H75C78 38 80 40 80 43V68C80 71 78 73 75 73H25C22 73 20 71 20 68V43C20 40 22 38 25 38Z"
                />

                <circle
                  className="camera-lens"
                  cx="50"
                  cy="55"
                  r="11"
                />

              </svg>

              <span className="camera-text">
                Take Photo
              </span>

            </button>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={
                handleCameraCapture
              }
              disabled={processing}
              style={{
                display: "none",
              }}
            />

          </div>

          {/* SELECTED FILE */}

          {files.length > 0 && (
            <div className="selected-file selected-files">

              <div className="selected-files-header">
                📎 Selected {files.length} file{files.length === 1 ? "" : "s"}
              </div>

              <div className="selected-files-list">
                {files.map((selectedFile, index) => (
                  <div className="selected-file-item" key={`${selectedFile.name}-${selectedFile.lastModified}-${index}`}>
                    <span>📄</span>
                    <strong title={selectedFile.name}>
                      {selectedFile.name}
                    </strong>
                    <small>
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </small>
                  </div>
                ))}
              </div>

            </div>
          )}

        </section>

        {/* =================================================
            ACTION SECTION
        ================================================= */}

        <section className="action-section" id="action-section">

          {/* HEADING + CHATBOT ICON */}

          <div className="action-heading-row">

            <h2>
              What would you like to do?
            </h2>

            <button
              type="button"
              className={`chatbot-heading-button ${
                chatOpen
                  ? "chatbot-heading-active"
                  : ""
              }`}
              onClick={toggleChat}
              aria-label={
                chatOpen
                  ? "Close AI chatbot"
                  : "Open AI chatbot"
              }
              title={
                chatOpen
                  ? "Close AI chatbot"
                  : "Ask StudyFlow AI"
              }
            >

              <span className="heading-robot-icon">
                🤖
              </span>

            </button>

          </div>

          {/* MODE BUTTONS */}

          <div className="mode-buttons">

            {/* SUMMARY */}

            <button type="button"
              className={
                mode === "summary"
                  ? "mode active"
                  : "mode"
              }
              onClick={() =>
                setMode("summary")
              }
            >

              <span>
                📝
              </span>

              <div>

                <strong>
                  Summary
                </strong>

                <small>
                  Key points from your material
                </small>

              </div>

            </button>

            {/* EXPLAIN */}

            <button type="button"
              className={
                mode === "explain"
                  ? "mode active"
                  : "mode"
              }
              onClick={() =>
                setMode("explain")
              }
            >

              <span>
                💡
              </span>

              <div>

                <strong>
                  Explanation
                </strong>

                <small>
                  Understand difficult concepts
                </small>

              </div>

            </button>

            {/* QUIZ */}

            <button type="button"
              className={
                mode === "quiz"
                  ? "mode active"
                  : "mode"
              }
              onClick={() =>
                setMode("quiz")
              }
            >

              <span>
                🧠
              </span>

              <div>

                <strong>
                  Quiz
                </strong>

                <small>
                  Test your knowledge
                </small>

              </div>

            </button>

            {/* FLASHCARDS */}

            <button type="button"
              className={
                mode === "flashcards"
                  ? "mode active"
                  : "mode"
              }
              onClick={() =>
                setMode("flashcards")
              }
            >

              <span>
                🗂️
              </span>

              <div>

                <strong>
                  Flashcards
                </strong>

                <small>
                  Review key concepts quickly
                </small>

              </div>

            </button>

            {/* TEST CONCEPTS */}

            <button type="button"
              className={
                mode === "test"
                  ? "mode active"
                  : "mode"
              }
              onClick={() => setMode("test")}
            >
              <span>⏱️</span>
              <div>
                <strong>Test concepts</strong>
                <small>MCQ's test from your material</small>
              </div>
            </button>

            {/* ORAL TEST */}

            <button type="button"
              className={
                mode === "oral"
                  ? "mode active"
                  : "mode"
              }
              onClick={() => setMode("oral")}
            >
              <span>🎙️</span>
              <div>
                <strong>Oral Test</strong>
                <small>Answer questions by speaking</small>
              </div>
            </button>

          </div>

          {/* GENERATE */}

          <button
            className="generate-button"
            onClick={handleGenerate}
            disabled={
              processing ||
              generating ||
              flashcardsLoading ||
              oralExam.listening
            }
          >

            {generating || flashcardsLoading
              ? "⏳ Generating..."
              : mode === "flashcards"
                ? "✨ Generate Flashcards"
                : mode === "oral"
                  ? "🎙️ Start Oral Test"
                  : `✨ Generate ${mode}`}

          </button>

        </section>

        {/* =================================================
            GENERATED RESULT
        ================================================= */}

        {result && (
          <section
            className="result-section"
            id="result-section"
          >

            <div className="result-header">

              <div>

                <span className="result-icon">

                  {mode === "summary"
                    ? "📝"
                    : mode === "explain"
                      ? "💡"
                      : "🧠"}

                </span>

                <div>

                  <h2>

                    {mode === "summary"
                      ? "Summary"
                      : mode === "explain"
                        ? "Explanation"
                        : "Quiz"}

                  </h2>

                  <small>

                    {resultLanguage ===
                    "arabic"
                      ? "العربية"
                      : resultLanguage ===
                          "urdu"
                        ? "Urdu"
                        : resultLanguage ===
                            "mixed"
                          ? "Mixed language"
                          : "English"}

                  </small>

                </div>

              </div>

              {/* RESULT ACTIONS */}

              <div className="result-actions">

                <button
                  onClick={
                    handleCopy
                  }
                  className="secondary-button"
                  title="Copy result"
                >
                  📋 Copy
                </button>

                <button
                  onClick={
                    handleDownloadPDF
                  }
                  className="download-button"
                  title="Download PDF"
                >
                  📄 Download PDF
                </button>

                <button
                  onClick={
                    handleReadAloud
                  }
                  className="read-aloud-button"
                  title={
                    isSpeaking
                      ? "Stop reading"
                      : "Read result aloud"
                  }
                >

                  {isSpeaking
                    ? "⏹ Stop"
                    : "🔊 Read Aloud"}

                </button>

              </div>

            </div>

            {/* RESULT CONTENT */}

            <div
              className="result-content"
              dir={
                resultLanguage ===
                  "arabic" ||
                resultLanguage ===
                  "urdu"
                  ? "rtl"
                  : "ltr"
              }
            >

              {result
                .split("\n")
                .map(
                  (line, index) => (
                    <p key={index}>
                      {line ||
                        "\u00A0"}
                    </p>
                  )
                )}

            </div>

          </section>
        )}

      </main>

      {/* ==================================================
          GENERATED STUDY SECTIONS
          Keep generated UI aligned with the main app width.
      ================================================== */}

      <div className="generated-study-sections">

      {/* ==================================================
          FLASHCARDS
      ================================================== */}

      {flashcards.length > 0 && (
        <section
          className="flashcards-section"
          id="flashcards-section"
        >

          <div className="flashcards-header">
            <div>
              <span className="result-icon">🗂️</span>
              <div>
                <h2>Flashcards</h2>
                <small>
                  Tap the card to reveal the answer
                </small>
              </div>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={handleGenerateFlashcards}
              disabled={flashcardsLoading}
            >
              {flashcardsLoading
                ? "⏳ Generating..."
                : "🔄 Regenerate"}
            </button>
          </div>

          <div className="flashcard-progress">
            Card {flashcardIndex + 1} of {flashcards.length}
          </div>

          <button
            type="button"
            className={`flashcard ${flashcardFlipped ? "is-flipped" : ""}`}
            onClick={handleFlipFlashcard}
            aria-label="Flip flashcard"
          >
            <div className="flashcard-inner">

              <div className="flashcard-face flashcard-front">
                <span className="flashcard-label">
                  QUESTION
                </span>

                <p>
                  {flashcards[flashcardIndex]?.front}
                </p>

                <small>
                  Click to reveal answer
                </small>
              </div>

              <div className="flashcard-face flashcard-back">
                <span className="flashcard-label">
                  ANSWER
                </span>

                <p>
                  {flashcards[flashcardIndex]?.back}
                </p>

                <small>
                  Click to see the question
                </small>
              </div>

            </div>
          </button>

          <div className="flashcard-controls">

            <button
              type="button"
              className="secondary-button"
              onClick={handlePreviousFlashcard}
              disabled={flashcardIndex === 0}
            >
              ← Previous
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={handleFlipFlashcard}
            >
              🔄 Flip
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={handleNextFlashcard}
              disabled={
                flashcardIndex === flashcards.length - 1
              }
            >
              Next →
            </button>

          </div>

        </section>
      )}

      {/* ==================================================
          TEST CONCEPTS
      ================================================== */}

      {testQuestions.length > 0 && (
        <section className="test-concepts-section" id="test-concepts-section">
          <div className="test-concepts-header">
            <div>
              <span className="section-kicker">EXAM SIMULATION</span>
              <h2>Test concepts</h2>
              <p>Timed multiple-choice questions generated from your study material.</p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={handleGenerateTest}
              disabled={testLoading}
            >
              {testLoading ? "Generating..." : "Regenerate test"}
            </button>
          </div>

          {!testStarted && !testFinished && (
            <div className="test-start-card">
              <div className="test-start-icon">⏱️</div>
              <h3>{testQuestions.length} MCQs • {Math.round(testTotalSeconds / 60)} minutes</h3>
              <p>Choose one answer for each question. Your result is shown after you submit or the timer expires.</p>
              <button type="button" className="generate-button" onClick={startTest}>Start Test</button>
            </div>
          )}

          {testStarted && !testFinished && testQuestions[testIndex] && (
            <div className="test-question-card">
              <div className="test-progress-row">
                <span>Question {testIndex + 1} of {testQuestions.length}</span>
                <strong className={testTimeLeft <= 60 ? "test-timer danger" : "test-timer"}>
                  ⏱ {formatTestTime(testTimeLeft)}
                </strong>
              </div>

              <div className="test-progress-track">
                <span style={{ width: `${((testIndex + 1) / testQuestions.length) * 100}%` }} />
              </div>

              <h3>{testQuestions[testIndex].question}</h3>

              <div className="test-options">
                {(Array.isArray(testQuestions[testIndex].options) ? testQuestions[testIndex].options : []).map((option, optionIndex) => {
                  const selected = testAnswers[testIndex] === option;
                  return (
                    <button
                      type="button"
                      key={optionIndex}
                      className={selected ? "test-option selected" : "test-option"}
                      onClick={() => selectTestAnswer(option)}
                    >
                      <span>{String.fromCharCode(65 + optionIndex)}</span>
                      {option}
                    </button>
                  );
                })}
              </div>

              <div className="test-navigation-buttons">
                {testIndex < testQuestions.length - 1 && (
                  <button
                    type="button"
                    className="generate-button test-next-button"
                    onClick={nextTestQuestion}
                    disabled={!testAnswers[testIndex]}
                  >
                    Next Question →
                  </button>
                )}

                <button
                  type="button"
                  className="generate-button test-submit-button"
                  onClick={() => {
                    const unanswered =
                      testQuestions.length - Object.keys(testAnswers).length;

                    const message =
                      unanswered > 0
                        ? `You have ${unanswered} unanswered question${
                            unanswered === 1 ? "" : "s"
                          }. Are you sure you want to submit?`
                        : "Are you sure you want to submit your test?";

                    if (window.confirm(message)) {
                      finishTest();
                    }
                  }}
                >
                  Submit Test
                </button>
              </div>
            </div>
          )}

          {testFinished && (
            <div className="test-result-card">
              <div className="test-result-icon">🏆</div>
              <span className="section-kicker">TEST COMPLETE</span>
              <h3>{testScore} / {testQuestions.length}</h3>
              <p className="test-percentage">{Math.round((testScore / testQuestions.length) * 100)}%</p>
              <p>You completed the Test concepts exam.</p>
              <div className="test-result-actions">
                <button type="button" className="generate-button" onClick={startTest}>Retake Test</button>
                <button type="button" className="secondary-button" onClick={handleGenerateTest}>Generate New Test</button>
              </div>
            </div>
          )}
        </section>
      )}

      </div>

      {/* ==================================================
          GAMES PANEL
      ================================================== */}

      {gamesOpen && (
        <div className="games-overlay" role="dialog" aria-modal="true" aria-label="StudyFlow games">
          <div className="games-panel">
            <button
              type="button"
              className="games-panel-close"
              onClick={() => {
                setGamesOpen(false);
                setGuessGameStarted(false);
                setBalloonGameStarted(false);
                setBalloons([]);
              }}
              aria-label="Close games"
              title="Close games"
            >
              ×
            </button>

            <div className="games-panel-heading">
              <span className="section-kicker">FUN ZONE</span>
              <h2>🎮 StudyFlow Games</h2>
              <p>Take a quick break and have some fun while learning.</p>
            </div>

            <div className="games-grid">

        <section className="guess-word-game" id="guess-word-game">
          <button
            type="button"
            className="guess-word-close-button"
            onClick={() => {
              setGuessGameStarted(false);
              setGuessGameStatus("idle");
              setGuessMessage("");
              setGuessInput("");
              setGuessedLetters([]);
            }}
            aria-label="Close Guess the Word game"
            title="Close game"
          >
            ×
          </button>

          <div className="guess-word-game-header">
          <span className="section-kicker">FUN ZONE</span>
          <h2>🎯 Guess the Word</h2>
          <p>Guess the hidden word one character at a time.</p>
        </div>

        <div className="guess-word-board">
          <div className="guess-word-blanks" aria-label="Hidden word">
            {guessGameStarted ? guessWord.split("").map((character, index) => (
              <span key={`${character}-${index}`} className="guess-word-letter">
                {guessedLetters.includes(character) ? character : "_"}
              </span>
            )) : "_ _ _ _ _"}
          </div>

          <div className="guess-word-tries">
            {guessGameStarted ? `Tries: ${guessTries}` : "Start a game to begin"}
          </div>

          <button type="button" className="guess-word-start-button" onClick={startGuessWordGame}>
            {guessGameStarted ? "🔄 New Word" : "▶ Start Game"}
          </button>

          {guessGameStarted && guessGameStatus === "playing" && (
            <button
              type="button"
              className="guess-word-reveal-button"
              onClick={handleRevealGuessWord}
            >
              👀 Reveal Word
            </button>
          )}

          {guessGameStarted && guessGameStatus === "playing" && (
            <>
              <label className="guess-word-input-label" htmlFor="guess-word-input">Enter a character</label>
              <div className="guess-word-input-row">
                <input id="guess-word-input" type="text" inputMode="lowercase" autoComplete="off" maxLength={1} value={guessInput}
                  onChange={(event) => setGuessInput(event.target.value.toLowerCase().replace(/[^a-z]/g, ""))}
                  onKeyDown={handleGuessInputKeyDown} placeholder="a" aria-label="Enter one lowercase English character" />
                <button type="button" className="guess-word-submit-button" onClick={handleGuessLetter} disabled={!guessInput}>Guess</button>
              </div>
            </>
          )}

          {guessMessage && <div className={`guess-word-message ${guessGameStatus}`} role="status">{guessMessage}</div>}

          {(guessGameStatus === "won" || guessGameStatus === "lost") && (
            <button type="button" className="guess-word-play-again" onClick={startGuessWordGame}>🎮 Play Again</button>
          )}
          </div>
        </section>


      {/* ==================================================
          BALLOON LETTER GAME
      ================================================== */}

      <section
        className="balloon-letter-game"
        id="balloon-letter-game"
      >
        <div className="balloon-game-header">
          <span className="section-kicker">FUN ZONE</span>
          <h2>🎈 Catch the Letter</h2>
          <p>Click the balloon that matches the target letter.</p>
        </div>

        {!balloonGameStarted ? (
          <div className="balloon-game-start-panel">
            <div className="balloon-preview">🎈 🎈 🎈</div>

            <button
              type="button"
              className="balloon-start-button"
              onClick={startBalloonGame}
            >
              ▶ Start Game
            </button>
          </div>
        ) : (
          <div className="balloon-game-board">
            <button
              type="button"
              className="balloon-close-button"
              onClick={closeBalloonGame}
              aria-label="Close Catch the Letter game"
              title="Close game"
            >
              ×
            </button>

            <div className="balloon-game-top">
              <div>
                <span className="balloon-target-label">TARGET</span>
                <strong className="balloon-target-letter">
                  {balloonTargetLetter.toUpperCase()}
                </strong>
              </div>

              <div className="balloon-score">
                ⭐ {balloonScore}
              </div>
            </div>

            <div
              className="balloon-falling-area"
              onAnimationEnd={handleBalloonRoundEnd}
            >
              <div className="balloon-bottom-line" />

              {balloons.map((balloon) => (
                <button
                  key={balloon.id}
                  type="button"
                  className={`falling-balloon ${balloon.status}`}
                  style={{
                    left: `${balloon.left}%`,
                    animationDelay: `${balloon.delay}s`,
                    animationDuration: `${balloon.duration}s`,
                  }}
                  onClick={() => handleBalloonClick(balloon)}
                  disabled={balloon.status !== "falling"}
                  aria-label={`Balloon letter ${balloon.letter}`}
                >
                  {balloon.status === "wrong"
                    ? "×"
                    : balloon.letter.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="balloon-game-message">
              {balloonGameMessage ||
                `Find the ${balloonTargetLetter.toUpperCase()} balloon!`}
            </div>
          </div>
        )}
      </section>

            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          AI ORAL EXAM
      ================================================== */}

      {oralExam.active && (
        <section className="oral-exam-section" id="oral-exam-section">
          <div className="oral-exam-header">
            <div>
              <span className="section-kicker">AI ORAL TEST</span>
              <h2>🎙️ Oral Exam</h2>
              <p>Listen to the question, then answer naturally using your voice. There is no text answer box.</p>
            </div>
            <button type="button" className="oral-close-button" onClick={handleStopOralExam} aria-label="Close oral exam">✕</button>
          </div>

          <div className="oral-exam-card">
            <div className="oral-exam-progress">
              <span>Question {oralExam.questionNumber} of {oralExam.totalQuestions}</span>
              <strong>Score: {oralExam.score}</strong>
            </div>

            <div className="oral-question-box">
              <span className="oral-ai-icon">🤖</span>
              <p dir={oralExam.language === "arabic" || oralExam.language === "urdu" ? "rtl" : "ltr"}>{oralExam.question}</p>
            </div>

            <div className="oral-status">
              {oralExam.status === "listening" && <><span className="oral-mic-pulse">🎙️</span><strong>Listening to your answer...</strong></>}
              {oralExam.status === "evaluating" && <><span>🧠</span><strong>AI is checking your answer...</strong></>}
              {oralExam.status === "feedback" && <><span>💬</span><strong>{oralExam.feedback}</strong></>}
              {oralExam.status === "waiting" && <><span>🎙️</span><strong>Your turn — speak your answer.</strong></>}
              {oralExam.status === "error" && <><span>⚠️</span><strong>Microphone recognition stopped. Try again.</strong></>}
            </div>

            <div className="oral-exam-controls">
              <button type="button" className={oralExam.listening ? "oral-mic-button listening" : "oral-mic-button"} onClick={startOralListening} disabled={oralExam.listening || oralExam.status === "evaluating"}>
                {oralExam.listening ? "🎙️ Listening..." : "🎙️ Speak Answer"}
              </button>
              <button type="button" className="secondary-button" onClick={handleRepeatOralQuestion} disabled={oralExam.listening || oralExam.status === "evaluating"}>🔊 Repeat Question</button>
            </div>

            <small className="oral-exam-language">Language: {oralExam.language === "urdu" ? "Urdu" : oralExam.language === "arabic" ? "Arabic" : oralExam.language === "mixed" ? "Mixed" : "English"}</small>
          </div>
        </section>
      )}

      {/* ==================================================
          CHAT POPUP
      ================================================== */}

      {chatOpen && (
        <div className="chatbot-popup">

          {/* CHAT HEADER */}

          <div className="chatbot-popup-header">

            <div className="chatbot-popup-title">

              <span className="popup-robot-icon">
                🤖
              </span>

              <div>

                <strong>
                  StudyFlow AI
                </strong>

                <small>
                  Ask from your material
                </small>

              </div>

            </div>

            <button
              type="button"
              className="chatbot-close-button"
              onClick={() =>
                setChatOpen(false)
              }
              aria-label="Close chatbot"
            >
              ×
            </button>

          </div>

          {/* MATERIAL STATUS */}

          <div
            className={
              materialReady
                ? "chat-material-status ready"
                : "chat-material-status"
            }
          >

            {materialReady
              ? "✓ Study material is ready"
              : "Upload or paste study material first"}

          </div>

          {/* CHAT MESSAGES */}

          <div
            className="chat-messages"
            ref={chatMessagesRef}
          >

            {chatMessages.length ===
              0 && (
              <div className="chat-welcome">

                <div className="chat-welcome-icon">
                  ✨
                </div>

                <h3>
                  Ask me anything
                </h3>

                <p>
                  Hi! I'm StudyFlow AI,
                  your AI-powered study
                  assistant. You can ask me
                  questions about your
                  uploaded or pasted study
                  material, and I'll do my
                  best to help you
                  understand it better.
                </p>

              </div>
            )}

            {chatMessages.map(
              (message, index) => {
                const isRTL =
                  message.language ===
                    "urdu" ||
                  message.language ===
                    "arabic";

                return (
                  <div
                    key={index}
                    className={
                      message.role ===
                      "user"
                        ? "chat-message user-message"
                        : "chat-message assistant-message"
                    }
                    dir={
                      isRTL
                        ? "rtl"
                        : "ltr"
                    }
                  >

                    <div className="message-avatar">

                      {message.role ===
                      "user"
                        ? "👤"
                        : "🤖"}

                    </div>

                    <div className="message-content">

                      {message.content
                        .split("\n")
                        .map(
                          (
                            line,
                            lineIndex
                          ) => (
                            <p
                              key={
                                lineIndex
                              }
                            >
                              {line ||
                                "\u00A0"}
                            </p>
                          )
                        )}

                    </div>

                  </div>
                );
              }
            )}

            {/* THINKING */}

            {chatLoading && (
              <div className="chat-message assistant-message">

                <div className="message-avatar">
                  🤖
                </div>

                <div className="message-content">

                  <p>
                    Thinking...
                  </p>

                </div>

              </div>
            )}

          </div>

          {/* CHAT INPUT */}

          <form
            className="chat-input-form"
            onSubmit={
              handleChatSubmit
            }
          >

            <input
              type="text"
              value={chatQuestion}
              onChange={(event) =>
                setChatQuestion(
                  event.target.value
                )
              }
              placeholder={
                materialReady
                  ? "Ask a question..."
                  : "Upload material first..."
              }
              disabled={
                !materialReady ||
                chatLoading
              }
            />

            <button
              type="submit"
              disabled={
                !materialReady ||
                chatLoading ||
                !chatQuestion.trim()
              }
            >

              {chatLoading
                ? "..."
                : "➤"}

            </button>

          </form>

        </div>
      )}

      {/* ==================================================
          FOOTER
      ================================================== */}

      <footer>

        <p
          style={{
            color: "white",
            fontSize: "18px",
          }}
        >

          <b>
            StudyFlow AI • Learn better,
            Grow faster. Developed by:
          </b>

        </p>

        <h3
          style={{
            color: "white",
            fontSize: "20px",
          }}
        >

          <b>
            M. Talha
          </b>

        </h3>

      </footer>

      {showGoUp && (
        <button
          className="go-up-button"
          onClick={
            scrollToTop
          }
          aria-label="Go to top"
          title="Go to top"
        >
          ⇧
        </button>
      )}

    </div>
  );
}

export default App;
