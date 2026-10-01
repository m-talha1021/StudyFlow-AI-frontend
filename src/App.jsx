import {
  useEffect,
  useRef,
  useState,
} from "react";

import "./App.css";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";

import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "./firebase";

// ========================================================
// BACKEND API
// ========================================================

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
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

        ...(auth.currentUser
          ? {
              Authorization: `Bearer ${await auth.currentUser.getIdToken()}`,
            }
          : {}),

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
          <button className="nav-link-button" onClick={onLogin}>Login</button>
          <button className="nav-signup-button" onClick={onSignup}>Sign Up</button>
        </div>
      </nav>

      <main className="welcome-page">
        <section className="welcome-hero">
          <div className="welcome-badge">✦ AI-powered learning</div>
          <h1>Study smarter.<br /><span>Understand faster.</span></h1>
          <p>
            StudyFlow AI turns your notes, documents and images into summaries,
            explanations, quizzes, flashcards and an interactive study assistant.
          </p>
          <div className="welcome-actions">
            <button className="primary-auth-button" onClick={onSignup}>Get Started</button>
            <button className="secondary-auth-button" onClick={onLogin}>I already have an account</button>
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
        <button className="nav-link-button" onClick={() => onModeChange("welcome")}>← Back</button>
      </nav>

      <main className="auth-page">
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-card-icon">✦</div>
          <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p>{isSignup ? "Start your personalized StudyFlow experience." : "Log in to continue learning."}</p>

          {error && <div className="auth-error">{error}</div>}

          {isSignup && (
            <label>
              Full name
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your name"
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
              onChange={(e) => setForm({ ...form, email: e.target.value })}
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
              onChange={(e) => setForm({ ...form, password: e.target.value })}
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
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
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
              className="auth-forgot-button"
              onClick={onForgotPassword}
              disabled={loading}
            >
              Forgot password?
            </button>
          )}

          <button className="primary-auth-button auth-submit" type="submit" disabled={loading}>
            {loading ? "Please wait..." : isSignup ? "Create Account" : "Login"}
          </button>

          <p className="auth-switch">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <button type="button" onClick={() => onModeChange(isSignup ? "login" : "signup")}>
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
  // AUTHENTICATION
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
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);

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
  // FIREBASE AUTH SESSION
  // ========================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setAuthChecked(true);

        if (firebaseUser) {
          setAuthView("app");
        } else {
          setAuthView((current) =>
            current === "login" || current === "signup"
              ? current
              : "welcome"
          );
        }
      }
    );

    return () => unsubscribe();
  }, []);

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
        case "auth/operation-not-allowed":
          setAuthError(
            "Email/password sign-in is not enabled in Firebase Authentication."
          );
          break;
        case "auth/network-request-failed":
          setAuthError(
            "Could not connect to Firebase. Check your internet connection and Firebase configuration."
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
      setAuthError(error.message || "Could not send the reset email.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Firebase logout error:", error);
    }

    setUser(null);
    setAuthView("welcome");
    setAuthForm({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
    setText("");
    setFile(null);
    setMaterialReady(false);
    setResult("");
    setFlashcards([]);
    setChatMessages([]);
    setChatOpen(false);
    stopSpeech();
  };

  const openAuth = (view) => {
    setAuthError("");
    setAuthView(view);
  };

  // ========================================================
  // FLASHCARD GENERATION
  // ========================================================

  const handleGenerateFlashcards = async () => {
    setFlashcardsLoading(true);
    setFlashcardFlipped(false);

    try {
      let ready = materialReady;

      // If the user pasted text but has not processed it yet, process it first.
      if (!ready && text.trim()) {
        const processed = await processPastedText();

        if (!processed) {
          return;
        }

        ready = true;
      }

      if (!ready && !file) {
        alert("Please upload or paste study material first.");
        document.getElementById("inputcard")?.scrollIntoView({ behavior: "smooth" });
        return;
      }

      const data = await apiRequest("/api/flashcards", {
        method: "POST",
        body: JSON.stringify({ count: 10 }),
      });

      setFlashcards(data.cards || []);
      setFlashcardIndex(0);
      setTimeout(() => {
        document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (error) {
      alert(error.message || "Could not generate flashcards.");
    } finally {
      setFlashcardsLoading(false);
    }
  };

  const nextFlashcard = () => {
    setFlashcardFlipped(false);
    setFlashcardIndex((index) => (index + 1) % flashcards.length);
  };

  const previousFlashcard = () => {
    setFlashcardFlipped(false);
    setFlashcardIndex((index) => (index - 1 + flashcards.length) % flashcards.length);
  };

  // ========================================================
  // PROCESS FILE
  // ========================================================

  const processFile = async (selectedFile) => {
    if (!selectedFile) {
      return;
    }

    setProcessing(true);
    setFile(selectedFile);
    setResult("");
    setResultLanguage("");
    setMaterialReady(false);
    setFlashcards([]);
    setFlashcardIndex(0);
    setFlashcardFlipped(false);

    // Reset chat when new material is uploaded
    setChatMessages([]);
    setChatQuestion("");

    stopSpeech();

    try {
      const formData = new FormData();

      formData.append(
        "file",
        selectedFile
      );

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
            "Could not process the file."
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
          "Could not process the uploaded document or image."
      );

      setFile(null);
      setMaterialReady(false);

    } finally {
      setProcessing(false);
    }
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
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setText("");

    processFile(selectedFile);
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
  // GENERATE RESULT
  // ========================================================

  const handleGenerate = async () => {
    // Flashcards use their dedicated generation endpoint, but remain
    // one of the selectable study modes instead of a separate section.
    if (mode === "flashcards") {
      await handleGenerateFlashcards();
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
  // AUTH GATING
  // ========================================================

  if (!authChecked) {
    return <div className="auth-loading-screen">Loading StudyFlow AI...</div>;
  }

  if (!user) {
    if (authView === "login" || authView === "signup") {
      return (
        <AuthPage
          mode={authView}
          onModeChange={(view) => setAuthView(view)}
          onSubmit={handleAuthSubmit}
          onForgotPassword={handleForgotPassword}
          loading={authLoading}
          error={authError}
          form={authForm}
          setForm={setAuthForm}
        />
      );
    }

    return <WelcomePage onLogin={() => openAuth("login")} onSignup={() => openAuth("signup")} />;
  }

  // ========================================================
  // UI
  // ========================================================

  return (
    <div className="app">

      {/* ==================================================
          NAVBAR
      ================================================== */}

      <header className="app-navbar">
        <BrandMark />

        <nav className="app-nav-links">
          <button onClick={() => document.getElementById("heroclass")?.scrollIntoView({ behavior: "smooth" })}>Dashboard</button>
          <button onClick={() => document.getElementById("inputcard")?.scrollIntoView({ behavior: "smooth" })}>Study Material</button>
          <button onClick={() => document.getElementById("action-section")?.scrollIntoView({ behavior: "smooth" })}>Quiz & AI</button>
        </nav>

        <div className="app-nav-user">
          <div className="user-pill">
            <span>👤</span>
            <strong>{user?.name || "Student"}</strong>
          </div>
          <button className="logout-button" onClick={handleLogout}>Logout</button>
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
                ? "Processing document or image..."
                : "Upload your document or image"}
            </strong>

            <small>
              PDF, DOCX, PPTX,
              JPG, PNG or WEBP
            </small>

            <input
              type="file"
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

          {file && (
            <div className="selected-file">

              📎 Selected:{" "}

              <strong>
                {file.name}
              </strong>

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
            <button
              type="button"
              className={mode === "summary" ? "mode active" : "mode"}
              onClick={() => {
                setMode("summary");
                setResult("");
              }}
            >
              <span>📝</span>
              <div>
                <strong>Summary</strong>
                <small>Key points from your material</small>
              </div>
            </button>

            {/* EXPLANATION */}
            <button
              type="button"
              className={mode === "explain" ? "mode active" : "mode"}
              onClick={() => {
                setMode("explain");
                setResult("");
              }}
            >
              <span>💡</span>
              <div>
                <strong>Explanation</strong>
                <small>Understand difficult concepts</small>
              </div>
            </button>

            {/* QUIZ */}
            <button
              type="button"
              className={mode === "quiz" ? "mode active" : "mode"}
              onClick={() => {
                setMode("quiz");
                setResult("");
              }}
            >
              <span>🧠</span>
              <div>
                <strong>Quiz</strong>
                <small>Test your knowledge</small>
              </div>
            </button>

            {/* FLASHCARDS */}
            <button
              type="button"
              className={mode === "flashcards" ? "mode active" : "mode"}
              onClick={() => {
                setMode("flashcards");
                setResult("");
              }}
            >
              <span>🗂️</span>
              <div>
                <strong>Flashcards</strong>
                <small>Active recall from your material</small>
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
                ? "🗂️ Generate Flashcards"
                : `✨ Generate ${mode}`}

          </button>

        </section>

        {/* =================================================
            GENERATED RESULT
        ================================================= */}

        {mode === "flashcards" && (flashcards.length > 0 || flashcardsLoading) && (
          <section
            className="result-section flashcards-result-section"
            id="result-section"
          >
            <div className="result-header">
              <div>
                <span className="result-icon">🗂️</span>
                <div>
                  <h2>Flashcards</h2>
                  <small>Active recall</small>
                </div>
              </div>
            </div>

            {flashcardsLoading && (
              <div className="flashcards-empty">
                <div className="flashcard-spinner">✦</div>
                <h3>Creating your flashcards...</h3>
                <p>StudyFlow AI is selecting important concepts from your material.</p>
              </div>
            )}

            {flashcards.length > 0 && !flashcardsLoading && (
              <div className="flashcard-study-area">
                <div className="flashcard-progress">
                  Card {flashcardIndex + 1} of {flashcards.length}
                </div>

                <button
                  type="button"
                  className={`flashcard ${flashcardFlipped ? "is-flipped" : ""}`}
                  onClick={() => setFlashcardFlipped((value) => !value)}
                  aria-label="Flip flashcard"
                >
                  <div className="flashcard-inner">
                    <div className="flashcard-face flashcard-front">
                      <span>QUESTION</span>
                      <strong>{flashcards[flashcardIndex]?.front}</strong>
                      <small>Click to reveal answer</small>
                    </div>
                    <div className="flashcard-face flashcard-back">
                      <span>ANSWER</span>
                      <strong>{flashcards[flashcardIndex]?.back}</strong>
                      <small>Click to see the question</small>
                    </div>
                  </div>
                </button>

                <div className="flashcard-controls">
                  <button type="button" onClick={previousFlashcard}>← Previous</button>
                  <button type="button" className="flip-button" onClick={() => setFlashcardFlipped((value) => !value)}>↻ Flip</button>
                  <button type="button" onClick={nextFlashcard}>Next →</button>
                </div>
              </div>
            )}
          </section>
        )}

        {mode !== "flashcards" && result && (
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
