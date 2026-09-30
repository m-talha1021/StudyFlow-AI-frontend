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
  serverTimestamp,
} from "firebase/firestore";

import "./App.css";

// ========================================================
// BACKEND API
// ========================================================

const API_BASE_URL =
  "https://study-flow-ai-backend.vercel.app";

// ========================================================
// API HELPER
// ========================================================

const apiRequest = async (endpoint, options = {}) => {
  const isFormData =
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
      <span>StudyFlow AI</span>
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

  return (
    <div className="auth-shell">
      <nav className="public-navbar">
        <BrandMark />
        <button
          type="button"
          className="nav-link-button"
          onClick={() => onModeChange("welcome")}
        >
          ← Back
        </button>
      </nav>

      <main className="auth-page">
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-card-brand">
            <img src="/favicon.png" alt="StudyFlow AI" />
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
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  password: event.target.value,
                }))
              }
              placeholder="At least 6 characters"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={6}
              required
            />
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
                minLength={6}
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
  // TEST TIMER
  // ========================================================

  useEffect(() => {
    if (!testStarted || testFinished) return;

    if (testTimeLeft <= 0) {
      const score = testQuestions.reduce((total, question, index) => {
        return total + (testAnswers[index] === question.answer ? 1 : 0);
      }, 0);
      setTestScore(score);
      setTestFinished(true);
      setTestStarted(false);
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
    };
  }, []);

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
            "Failed to connect to Firebase. Check your Firebase configuration and internet connection."
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
    stopSpeech();
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

  const finishTest = () => {
    const score = calculateTestScore();
    setTestScore(score);
    setTestFinished(true);
    setTestStarted(false);
    setTestIndex(0);
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
        alert("Please upload study material or paste your notes first.");
        return;
      }

      const data = await apiRequest("/api/test-concepts", {
        method: "POST",
        body: JSON.stringify({ count: 30 }),
      });

      if (!data.success || !Array.isArray(data.questions) || !data.questions.length) {
        throw new Error(data.error || "Could not generate the test.");
      }

      setTestQuestions(data.questions);
      setTestAnswers({});
      setTestIndex(0);
      setTestScore(0);
      setTestFinished(false);
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
          HEADER
      ================================================== */}

      <header className="header">

        <div className="logo">

          <div className="logo-icon">
            <a href="#"><img src="favicon.png" height="65px" width="59px"></img></a>
          </div>
          <span>
           <a href="#heroclass"> StudyFlow AI</a>
          </span>

        </div>

        <p className="tagline">
          <b>
            Your AI-powered study assistant
          </b>
        </p>

        <div className="header-actions">
          <div className="uploadBtn">
            <a href="#inputcard">
              Upload
            </a>
          </div>

          <div className="user-account">
            <span className="user-name">
              {user.displayName || user.email || "Account"}
            </span>
            <button
              type="button"
              className="logout-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>

      </header>

      {/* ==================================================
          MAIN
      ================================================== */}

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

        <section className="action-section">

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

            <button
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

            <button
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

            <button
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

            <button
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

            <button
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
                <small>Timed MCQ exam from your material</small>
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
              flashcardsLoading
            }
          >

            {generating || flashcardsLoading
              ? "⏳ Generating..."
              : mode === "flashcards"
                ? "✨ Generate Flashcards"
                : mode === "test"
                  ? "⏱️ Generate Test"
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
            className={`flashcard ${flashcardFlipped ? "flipped" : ""}`}
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
                {testQuestions[testIndex].options.map((option, optionIndex) => {
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

              <button
                type="button"
                className="generate-button test-next-button"
                onClick={nextTestQuestion}
                disabled={!testAnswers[testIndex]}
              >
                {testIndex === testQuestions.length - 1 ? "Submit Test" : "Next Question →"}
              </button>
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

      {/* ==================================================
          GO TO TOP
      ================================================== */}

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
