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
        const nextQuote = pickMotivationalQuote(previousQuoteRef.current);
        previousQuoteRef.current = nextQuote;
        setMotivationalQuote(nextQuote);
        setAuthView("app");
      }
    });

    return () => unsubscribe();
  }, []);

  // Shared result links are readable without signing in (Firestore rules must
  // allow public reads of sharedResults documents).
  useEffect(() => {
    const shareId = new URLSearchParams(window.location.search).get("shared");
    if (!shareId) return;
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await getDoc(doc(db, "sharedResults", shareId));
        if (!snapshot.exists()) throw new Error("This shared result link is invalid or has expired.");
        const shared = snapshot.data();
        if (!shared?.result) throw new Error("No result was found at this link.");
        if (cancelled) return;
        setSharedPublicData({ ...shared, id: shareId });
        setResult(shared.result);
        setMode(shared.mode || "summary");
        setResultLanguage(shared.language || "english");
      } catch (error) {
        if (!cancelled) setSharedPublicError(error.message || "Could not load this shared result.");
      }
    })();
    return () => { cancelled = true; };
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

      setProcessedMaterialText(data.materialText || text.trim());
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
            LECTURE TRANSCRIPTION
        ================================================= */}
        <section className="transcription-section" id="transcribing-section">
          <div className="transcription-heading">
            <span className="transcription-kicker">AUDIO TO TEXT</span>
            <h2>🎙️ Lecture Transcribing</h2>
            <p>Upload audio/video/recording file & convert it into text.</p>
          </div>
          <div className="transcription-card">
            <input
              ref={transcriptionInputRef}
              className="transcription-file-input"
              type="file"
              accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,.ogg,.flac,audio/*,video/mp4,video/webm"
              onChange={handleTranscriptionFileChange}
              disabled={transcriptionLoading}
            />
            <button type="button" className="transcription-choose-button" onClick={() => transcriptionInputRef.current?.click()} disabled={transcriptionLoading}>
              <span aria-hidden="true">📁</span>
              {transcriptionFile ? "Choose another file" : "Choose audio or video"}
            </button>
            <p className="transcription-formats">MP3, MP4, MPEG, M4A, WAV, WebM, OGG or FLAC · Up to 100MB size.</p>

            <div className="transcription-language-select" style={{ display: "flex", flexDirection: "column", gap: "6px", margin: "4px 0 10px" }}>
              <label htmlFor="transcription-language" style={{ fontWeight: 600, fontSize: "0.9rem" }}>Select language:</label>
              <select
                id="transcription-language"
                value={transcriptionSourceLanguage}
                onChange={(event) => setTranscriptionSourceLanguage(event.target.value)}
                disabled={transcriptionLoading}
                style={{
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "#0f1b3d",
                  color: "#e8eeff",
                  fontSize: "0.9rem",
                  width: "250px",
                  maxWidth: "100%",
                  boxSizing: "border-box"
                }}
              >
                <option value="auto">Auto-detect</option>
                <option value="urdu">Urdu</option>
                <option value="english">English</option>
                <option value="arabic">Arabic</option>
                <option value="hindi">Hindi</option>
                <option value="mixed">Mixed languages</option>
              </select>
            </div>

            {transcriptionFile && (
              <div className="transcription-selected-file">
                <span aria-hidden="true">🎧</span>
                <div>
                  <strong>{transcriptionFile.name}</strong>
                  <small>{(transcriptionFile.size / (1024 * 1024)).toFixed(2)} MB</small>
                </div>
                <button type="button" onClick={() => {
                  setTranscriptionFile(null);
                  setTranscriptionError("");
                  setTranscriptionNotice("");
                  setTranscriptionText("");
                  setTranscriptionLanguage("");
                  setTranscriptionProgress("");
                }} disabled={transcriptionLoading} aria-label="Remove selected file">×</button>
              </div>
            )}

            <button type="button" className="transcription-submit-button" onClick={transcribeLecture} disabled={!transcriptionFile || transcriptionLoading}>
              {transcriptionLoading ? "Transcribing..." : "Transcribe"}
            </button>
            {transcriptionLoading && (
              <div className="transcription-progress" role="status">
                <span className="transcription-spinner" />
                <span>{transcriptionProgress || "Recognizing speech and detecting transcript language…"}</span>
              </div>
            )}
            {transcriptionError && <div className="transcription-message error" role="alert">{transcriptionError}</div>}
            {transcriptionNotice && <div className="transcription-message success" role="status">{transcriptionNotice}</div>}

            {transcriptionText && (
              <div className="transcription-result">
                <div className="transcription-result-header">
                  <div>
                    <span className="transcription-kicker">YOUR TRANSCRIPT</span>
                    <h3>Transcript is ready:</h3>
                  </div>
                  <div className="transcription-result-actions">
                    <button type="button" className="transcription-secondary-button" onClick={copyTranscription}>Copy📋</button>
                    <button type="button" className="transcription-secondary-button" onClick={downloadTranscription}>Download TXT</button>
                  </div>
                </div>
                <textarea
                  className="transcription-output"
                  value={transcriptionText}
                  onChange={(event) => setTranscriptionText(event.target.value)}
                  aria-label="Editable lecture transcript"
                  dir={RTL_TRANSCRIPTION_LANGUAGES.includes(transcriptionLanguage) ? "rtl" : "auto"}
                  spellCheck="false"
                />
              </div>
            )}
          </div>
        </section>
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
      <CookieConsent />


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
            © StudyFlow AI • Learn better,
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
