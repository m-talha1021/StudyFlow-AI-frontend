# StudyFlow AI — Frontend

StudyFlow AI turns lectures, notes, and documents into summaries,
explanations, quizzes, flashcards, tests, oral exams, and an AI study
assistant. This repository is the **frontend** (React 19 + Vite 8 +
Firebase 12). The backend is a separate Flask service:
[`m-talha1021/StudyFlow-AI-backend`](https://github.com/m-talha1021/StudyFlow-AI-backend).

Live site: **https://study-flow-ai-lac.vercel.app**

## Features

- Email/password auth with enforced email verification, plus Google sign-in
- Lecture transcription (audio/video → text, with large-file chunking)
- Study material from pasted text, PDF, DOCX, PPTX, and images (OCR)
- AI Summary, Explanation, Quiz, Flashcards, Test Concepts, Oral Exam, and
  AI Chat over your material
- Study history (dashboard), shareable result links, PDF export
- Client-side file converters (Image→PDF, PDF→Image, Word→PDF, PDF→Word)
- Fun Zone games, feedback form, cookie consent
- Plans page (Free vs Pro “coming soon”), first-run onboarding with a
  built-in sample lecture, Privacy Policy and Terms pages, Settings page
  (profile, plan, sign-out, account deletion)
- Google Analytics 4, loaded only when `VITE_GA_MEASUREMENT_ID` is set

## Stack

- React 19, Vite 8, Firebase 12 (Auth + Firestore)
- `pdfjs-dist`, `mammoth`, `tesseract.js`, `jspdf`, `html2pdf.js`

## Run locally

```bash
npm install
npm run dev
```

The dev server runs at http://localhost:5173.

## Build

```bash
npm run build   # outputs to dist/
npm run preview # serve the production build locally
```

## Environment variables

Copy these into a local `.env` file (never commit it) or set them in
Vercel (Project Settings → Environment Variables). All are `VITE_*`
because they are read by the browser bundle.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | Yes | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | No | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | No | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase app ID |
| `VITE_API_BASE_URL` | No | Backend API base URL (defaults to https://study-flow-ai-backend.vercel.app) |
| `VITE_GA_MEASUREMENT_ID` | No | Google Analytics 4 measurement ID (e.g. `G-XXXXXXX`). Analytics is a no-op when unset. |

If any required Firebase variable is missing, the app shows a
“Setup needed” screen instead of a blank page.

## Deploy

The production site auto-deploys from the `main` branch on Vercel
(project `study-flow-ai-lac`). Push to `main` and Vercel builds and
deploys automatically.

## Firebase setup the owner must do

1. **Firestore rules**: publish `firestore.rules` from this repo in the
   Firebase Console (Firestore Database → Rules). Vercel deploys do not
   publish rules.
2. **Google sign-in**: Firebase Console → Authentication → Sign-in method
   → enable **Google**.
3. **Email/password sign-in** must stay enabled (Authentication →
   Sign-in method → Email/Password).

## Plans

StudyFlow AI is free for now. The Free plan allows 5 AI calls and 20
transcription minutes per day. A Pro plan (500 AI calls / 300
transcription minutes per day) is shown in the app as “coming soon” —
no payment flow is wired up yet. The backend reads a `plan` field on
`users/{uid}` (`"free"` by default; a missing field means free).

## License

MIT — see [LICENSE](LICENSE).
