# Murmur

## Introduction

Murmur is a social-connection platform built around people’s YouTube tastes. Instead of asking users to write profiles or swipe through cards, it uses their liked YouTube videos and channel subscriptions to create a taste profile, find people with similar interests, and let matched users chat.

The product promise is: **connect through what you watch**.

The current user journey is:

1. A visitor lands on the Murmur marketing page and selects **Get Started**.
2. On the welcome/onboarding screen, they sign in with Google.
3. On that same screen, they grant read-only YouTube access.
4. The backend fetches their liked videos and subscriptions.
5. Murmur embeds the 50 most recent liked videos, calculates an interest profile, scores other onboarded users, and stores the resulting matches.
6. The user selects their Indian Class X or Class Y city, then adds their age, gender, and optionally a short description before entering the app.
7. The user enters the Dashboard, then can access The Algorithm, Find, Activity, Matches, Dashboard, and their profile from the navigation bar.

The app currently displays version `v4.18` in the top-right of the navigation bar. Increment `src/config/appVersion.js` for every code change using two-digit minor versions: `4.19`, `4.20`, … `4.99`, after which it rolls over to `5.00`. Report the new version number to the user whenever a code change is delivered.

---

## Technology stack

| Area | Technology |
| --- | --- |
| Frontend | React, Vite, React Router |
| Backend | Node.js, Express 5 |
| Database | Cloud Firestore via Firebase Admin SDK |
| Authentication | Google Identity Services |
| YouTube data | YouTube Data API v3 with `youtube.readonly` scope |
| Interest embeddings | `@huggingface/transformers`, `Xenova/all-MiniLM-L6-v2` |
| Frontend hosting | Vercel |
| Backend hosting | Render |
| Styling | Plain CSS, custom dark/glassmorphism design system |

---

## Repository layout

```text
.
├── src/                         # React client
│   ├── components/              # Navbar, match cards, chat bubbles, loading UI
│   ├── config/appVersion.js     # Visible release version
│   ├── data/indiaXyCities.json  # Canonical eligible Indian locations
│   ├── contexts/AuthContext.jsx # Client session and API helpers
│   ├── pages/                   # Landing, onboarding, dashboard, discovery, matches, chat, profile
│   ├── App.jsx                  # Routes and application shell
│   ├── main.jsx                 # React entry point
│   └── index.css                # Design tokens and shared styles
├── server/                      # Express API
│   ├── config/firebase.js       # Firebase Admin and Firestore setup
│   ├── middleware/auth.js       # Unused development-only authentication middleware
│   ├── routes/                  # auth, youtube, matches, chat endpoints
│   ├── services/                # YouTube requests and semantic embeddings
│   └── index.js                 # Server setup and route registration
├── public/                      # Static files
├── .env.example                 # Required environment variables
├── package.json                 # Scripts and dependencies
└── ProjectDetails.md            # This project handoff document
```

Some Vite starter files still exist (`src/main.ts`, `src/counter.ts`, `src/style.css`, and starter SVG assets), but they are not imported by the actual application. The active client entry point is `src/main.jsx`.

---

## Local development

### Prerequisites

- Node.js with native `fetch` support (Node 18+ is recommended).
- A Google Cloud project with a **Web application** OAuth client.
- YouTube Data API v3 enabled in the same Google Cloud project.
- A Firebase project with Firestore enabled.

### Install and run

```bash
npm install
npm run dev
```

`npm run dev` starts both services:

- React/Vite client
- Express server on port `3001` by default

Other useful commands:

```bash
npm run client
npm run server
npm run build
npm run preview
```

### Environment variables

Copy `.env.example` to `.env` for local work and fill in the values. Do not commit `.env`.

```dotenv
# Google OAuth client ID used by the Render API and exposed safely to the browser
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Optional direct browser setting for local frontend-only development
VITE_GOOGLE_CLIENT_ID=

# Render API URL; required by Vercel deployments
VITE_API_URL=https://your-render-service.onrender.com

# YouTube / Firebase configuration
YOUTUBE_API_KEY=
FIREBASE_PROJECT_ID=
# Firebase Admin credentials for the Render backend. Use one method only.
# Recommended: Render secret file + GOOGLE_APPLICATION_CREDENTIALS path.
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase-service-account.json
# Alternative: one-line service-account JSON stored as a Render secret variable.
FIREBASE_SERVICE_ACCOUNT_JSON=
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=

PORT=3001
```

Important deployment rule: Vite only exposes variables that begin with `VITE_` at build time. In Vercel, `VITE_API_URL` must point to the public Render backend URL, without a trailing slash. A Vercel URL in this variable will make API calls return Vercel 404 pages.

`server/index.js` loads `.env` relative to the server folder, so a project-root `.env` works when running `npm run server`.

---

## Frontend architecture

### Routing

Routes are declared in `src/App.jsx`:

| Route | Page | Purpose |
| --- | --- | --- |
| `/` | `LandingPage` | Marketing page and Get Started entry point |
| `/onboarding` | `OnboardingPage` | Google sign-in, YouTube access, profile processing |
| `/algorithm` | `AlgorithmPage` | Placeholder for the matching-algorithm experience; currently displays “Coming soon” |
| `/find` | `FindPage` | Looks up a member by their exact Murmur user ID and opens their profile |
| `/matches` | `MatchesPage` | WhatsApp-style two-pane chat workspace; select a match to open its conversation |
| `/matches/:matchId` | `MatchesPage` | Opens a selected match in the workspace chat panel |
| `/dashboard` | `DashboardPage` | Default post-onboarding page with six empty widget containers in a 3-by-2 grid |
| `/chat/:matchId` | `ChatPage` | Legacy link that redirects into the selected workspace conversation |
| `/profile` | `ProfilePage` | Signed-in user's editable profile and sign-out |
| `/profile/:userId` | `ProfilePage` | Read-only, shareable view of another Murmur member's profile |

### Authentication context

`src/contexts/AuthContext.jsx` owns client-side session state:

- `user`: Google profile data returned by the backend.
- `youtubeToken`: temporary OAuth token used for YouTube API requests.
- `loading`: waits for local storage restoration.
- `isAuthenticated` and `isOnboarded`: derived booleans used by pages.

It persists the user object under `localStorage` key `murmur_user`. `signOut()` only clears this local state; it does not revoke the Google session or YouTube grant.

### Onboarding details

`OnboardingPage.jsx` is intentionally structured as a single flow:

1. If there is no user, it renders the Google Identity Services sign-in button.
2. Returning users whose Firestore profile is marked `onboarded` and has completed their details are sent directly to Matches after sign-in. Older accounts without profile details are sent directly to the details form, not asked to reconnect YouTube.
3. New users see the welcome screen and **Connect YouTube** button on the same screen. There is no separate YouTube tab.
4. Google OAuth requests `https://www.googleapis.com/auth/youtube.readonly`.
5. The app stores the short-lived access token in the backend’s in-memory token store.
6. It calls the YouTube fetch endpoint, then the matching-compute endpoint.
7. After analysis, the user must select a City in India from the local searchable Class X/Class Y list, then supplies Age (13–120), Gender (Male, Female, or Other), and may add a description of at most 100 words. The details are then stored before the completion/match-count screen.
8. Completing onboarding, visiting the landing page while already fully onboarded, or signing in as a fully onboarded user takes the member to `/dashboard`.

### Standardised Indian locations

Murmur uses the local `src/data/indiaXyCities.json` snapshot for every location selection. It contains 99 eligible 2011 Census urban locations: 8 Class X locations (population of 50 lakh or more) and 91 Class Y locations (5 lakh to below 50 lakh). The source baseline is the Office of the Registrar General & Census Commissioner, India’s [2011 A-04 town and urban-agglomeration table](https://censusindia.gov.in/nada/index.php/catalog/42876) and [Urban Agglomeration Primary Census Abstract](https://censusindia.gov.in/nada/index.php/catalog/45261/study-description).

Each list entry has an app-stable canonical `id`, canonical `city`, `state`, `country: "India"`, and `tier`; selected entries may also be found through legacy-name aliases such as Bangalore. The app sends the selected ID, but the backend treats that ID as authoritative and replaces the client-supplied city/state/country/tier values with the canonical local record before saving. This prevents misspellings, arbitrary locations, and forged display metadata from entering Firestore.

The reusable `IndiaLocationPicker` is used both during onboarding and on a member’s profile-edit screen. Older profiles with free-text locations are preserved for display, but a member must select an eligible canonical location when they next save their details.

Profiles use a page-based architecture rather than an in-place profile panel. The signed-in user can edit their own details at `/profile`; clicking a matched member's avatar/name in the Chats list or conversation header opens `/profile/:userId`. Each profile subtly shows its Firestore member ID. A non-owner viewing a profile also sees a **Message** button that opens that member's conversation in the Matches workspace. Public profiles never return email addresses, embeddings, category distributions, or YouTube viewing data.

The Google client ID is resolved in this order:

1. `VITE_GOOGLE_CLIENT_ID`, if present.
2. `GET /api/auth/google-client-id` from the configured Render API.

The second option is preferable for deployed environments because `GOOGLE_CLIENT_ID` remains the single source of configuration. OAuth client IDs are public identifiers and are safe to return to the browser.

### UI components

- `Navbar`: fixed top navigation with compact links ordered The Algorithm, Find, Activities, Matches, and Dashboard; a clickable user avatar opens Profile, and a version badge is shown alongside the links.
- `MatchCard`: clickable match row with match score and individual score factors.
- `PercentageRing`: animated SVG compatibility percentage.
- `ChatBubble`: sent/received chat-message display.
- `LoadingSpinner`: shared progress indicator.

The active design system is defined by CSS custom properties in `src/index.css`: deep navy background, red YouTube-inspired accent colors, glass cards, animation helpers, and shared button styles. Chat and Matches use the same visible doodle wallpaper over a black background.

---

## Backend architecture

The Express server is in `server/index.js`.

Middleware:

- `cors({ origin: true, credentials: true })`
- JSON request parsing, up to 10 MB
- Generic JSON 500 error handler

Health check:

```http
GET /api/health
```

Expected successful response:

```json
{ "status": "ok" }
```

### API reference

#### Authentication: `/api/auth`

| Method | Endpoint | Request | Response / purpose |
| --- | --- | --- | --- |
| `GET` | `/google-client-id` | None | Returns `{ "clientId": "..." }` from `GOOGLE_CLIENT_ID`; returns 503 when missing |
| `POST` | `/google` | `{ "credential": "Google ID token" }` | Parses user identity, upserts basic user fields, returns `{ user }` |
| `POST` | `/youtube-token` | `{ "accessToken", "userId" }` | Stores the token in memory for subsequent YouTube fetches |
| `GET` | `/profile/:userId` | None | Returns a safe public profile: name, avatar, onboarding state, and profile details only |
| `PATCH` | `/profile/:userId` | `{ "profileDetails": { "location": { "id" }, "age", "gender", "description" } }` | Validates the selected canonical Class X/Y ID, writes its canonical city/state/country/tier values, and marks `detailsComplete: true` |

#### YouTube: `/api/youtube`

| Method | Endpoint | Request | Purpose |
| --- | --- | --- | --- |
| `POST` | `/fetch` | `{ "userId" }` | Uses the stored user token to fetch liked videos and subscriptions |

The endpoint currently retrieves up to four 50-item pages (200 likes and 200 subscriptions maximum). The server returns raw results plus `likedCount` and `subscriptionCount`.

#### Matching: `/api/matches`

| Method | Endpoint | Request | Purpose |
| --- | --- | --- | --- |
| `POST` | `/compute` | `{ "userId", "likedVideos", "subscriptions" }` | Builds profile, saves it, calculates matches, returns them |
| `GET` | `/:userId` | None | Calculates and returns the user’s current top 10 matches, ordered by ascending percentage and annotated with unread-chat status |

The profile embedding uses the first 50 liked videos received from YouTube, intended to represent the user’s most recent tastes. Category statistics and subscription IDs still use all fetched data.

#### Chat: `/api/chat`

| Method | Endpoint | Request | Purpose |
| --- | --- | --- | --- |
| `POST` | `/send` | `{ "chatId", "senderId", "text" }` | Creates a message and updates chat metadata |
| `GET` | `/:chatId/messages` | None | Fetches up to 100 messages, oldest first |
| `POST` | `/:chatId/read` | `{ "userId" }` | Marks the chat’s latest message as read for that user |

The Find page checks the existing public-profile endpoint before navigation. An empty, unknown, or unavailable ID presents the user-facing message `No such user exists`; a valid ID opens `/profile/:userId`.

---

## YouTube ingestion and matching

### YouTube data

`server/services/youtube.js`:

- Calls `videos.list` with `myRating=like` and `part=snippet,topicDetails`.
- Calls `subscriptions.list` with `mine=true` and `part=snippet`.
- Converts each liked video into matching text using title, tags, mapped YouTube category, and channel name.

The category mapping is kept in `CATEGORY_MAP` in that same file.

### Embeddings

`server/services/embedding.js` lazy-loads `Xenova/all-MiniLM-L6-v2` through Transformers.js.

- The model is loaded once per server process and reused.
- Concurrent onboarding requests share the same loading promise.
- Video descriptions are processed in batches of 16, rather than one inference at a time.
- Each video vector is L2-normalized.
- The user vector is the normalized average of the video vectors.

The batching and 50-video profile bound are important. Render’s CPU and cold starts made the former per-video implementation slow enough for users to appear stuck at the “Computing AI taste profile” stage.

### Match formula

`computeMatchScore(userA, userB)` combines two signals:

| Signal | Method | Weight |
| --- | --- | --- |
| Content vibe | Cosine similarity of user embeddings | 60% |
| Categories | Cosine similarity of normalized category distributions | 40% |

The final score is a direct weighted average of these percentages. There is no minimum percentage threshold: every onboarded user can see up to their 10 highest-ranked eligible users.

---

## Firestore data model

### `users/{userId}`

Fields currently written include:

```js
{
  displayName,
  email,
  photoURL,
  onboarded,
  detailsComplete,
  profileDetails: {
    location: {
      id,                     // App-stable ID from indiaXyCities.json
      city,
      state,
      country: "India",
      tier                    // "X" (50 lakh+) or "Y" (5–50 lakh)
    },
    age,                    // Integer, 13–120
    gender,                 // "Male", "Female", or "Other"
    description             // Optional, 100 words maximum
  },
  createdAt,
  updatedAt,
  embedding,              // Array of numeric values
  categoryDistribution,   // { [youtubeCategoryId]: normalizedWeight }
  youtubeData: {
    likedVideoCount,
    subscriptionCount,
    topCategories
  }
}
```

### `matches/{sortedUserIdA_sortedUserIdB}`

```js
{
  users: [userIdA, userIdB],
  score,
  embeddingScore,
  categoryScore,
  createdAt
}
```

### `chats/{chatId}` and `chats/{chatId}/messages/{messageId}`

The backend writes:

```js
// Parent chat document
{
  users: [userIdA, userIdB],
  lastMessage,
  lastMessageAt,
  lastSenderId,
  readBy
}

// Message document
{
  senderId,
  text,
  createdAt
}
```

Chat messages are retrieved with polling every three seconds in the frontend. The matches list refreshes every ten seconds and highlights chats whose latest message was sent by the other person and has not been read, including chats created before unread tracking was added. The Matches page presents the match list and the active conversation in one desktop-style workspace; before a match is selected, its chat panel says “Click on any chat to message.” Firestore real-time listeners are not currently used.

---

## Deployment

### Render backend

Deploy the repository’s Node service with a start command equivalent to:

```bash
npm run server
```

Set at least:

- `GOOGLE_CLIENT_ID`
- `FIREBASE_PROJECT_ID`
- Either `GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase-service-account.json` with a Render secret file containing the Firebase service-account JSON, or `FIREBASE_SERVICE_ACCOUNT_JSON` with the full JSON value
- `PORT` is normally supplied by Render

Firestore Database must be created in the Firebase project before onboarding. The server now fails explicitly when its Firebase Admin credentials are absent or invalid, rather than silently returning zero matches. The server must be reachable over HTTPS. The first embedding request may take longer due to model initialization; the batching implementation minimizes subsequent processing time.

### Vercel frontend

Build command:

```bash
npm run build
```

Set:

```text
VITE_API_URL=https://your-render-service.onrender.com
```

`vercel.json` rewrites every browser URL to the Vite application entry point. This is required for direct visits or refreshes on client-side routes such as `/matches` and `/chat/:userId`; React Router then resolves the correct page. The saved `murmur_user` local-storage session restores an authenticated user after refresh. Without it, protected pages redirect to the landing-page login flow.

Redeploy Vercel after changing any `VITE_` variable because Vite injects these values at build time.

### Google Cloud configuration

The OAuth client must be a **Web application** client. Its Authorized JavaScript origins must include:

- The Vercel production domain
- Any Vercel preview domain used for testing, if applicable
- `http://localhost:<Vite-port>` for local development

The consent screen needs the intended tester accounts while the app is in Google’s testing mode. The test-user list only controls Google’s consent-screen access; it cannot fix a Vercel 404 or a wrong API URL.

Enable YouTube Data API v3 and include the `youtube.readonly` scope in the OAuth consent configuration as needed.

---

## Current limitations and important follow-up work

This project is an MVP. An AI or developer taking it forward should treat the following as high-priority production work:

1. **Authenticate API requests properly.** `server/routes/auth.js` parses Google ID-token payloads without verifying token signatures. `server/middleware/auth.js` also only decodes bearer tokens and is not mounted on routes. Use Firebase Auth or Google token verification on every protected endpoint.
2. **Protect authorization boundaries.** The current chat, match, and YouTube endpoints trust submitted `userId`/`senderId` values. A user can potentially access or write another user’s resources.
3. **Replace the in-memory YouTube token store.** Tokens disappear whenever Render restarts and do not work across multiple instances. Store encrypted refresh-token/session information securely, or request fresh access tokens as needed.
4. **Synchronize profile data in the frontend.** After onboarding, `AuthContext.setOnboarded()` updates only `onboarded`; it does not update local `youtubeData`, so profile statistics may not reflect the stored backend profile until the next sign-in.
5. **Improve error reporting.** Backend matching errors are reduced to a generic response. Surface safe, actionable errors and capture server logs/error monitoring.
6. **Add loading timeouts/fallbacks.** The embedding model is downloaded/initialized on cold Render instances. Consider prewarming, baking model files into the deployment image, a hosted embeddings API, or a deterministic fallback.
7. **Define privacy and retention policy.** Users are sharing sensitive viewing preferences. Add informed consent, deletion/export controls, retention rules, and secure Firestore rules before public launch.
8. **Add moderation and safety controls.** A people-matching product needs reporting, blocking, rate limiting, abuse prevention, and content moderation.
9. **Scale matching.** Current matching loads every onboarded user and computes scores in one request. This will not scale. Use vector search/ANN retrieval and queued jobs to produce candidates efficiently.
10. **Add tests.** There are currently no unit, integration, or end-to-end tests. Start with embedding/match-score tests, route tests, and an onboarding smoke test.

---

## Working conventions for future changes

- Use `src/main.jsx`, not the unused TypeScript starter entry point.
- Keep API requests based on `VITE_API_URL`; do not point it at Vercel.
- Keep Google sign-in and YouTube permission on the onboarding welcome screen unless the product flow changes intentionally.
- Preserve the 50-most-recent-video bound and batched embeddings unless a performance-tested replacement is introduced.
- After any frontend change, run `npm run build`.
- After any backend change, run `node --check` on changed server files and test the affected API if credentials are available.
- Increment `APP_VERSION` in `src/config/appVersion.js` for every code change, and report the new version number in the handoff.
- Update `ProjectDetails.md` whenever a change affects the project architecture, APIs, product flow, technical conventions, or release version.
- Do not commit secrets, Firebase service-account files, or `.env` files.

## Maintenance log

- `v4.15` (2026-07-17): Project architecture, APIs, technical stack, deployment model, product vision, and current limitations reviewed and documented as the active project context.
- `v4.16` (2026-07-17): Completed standardised Indian location selection with a local 2011 Census-based Class X/Y dataset, canonical Firestore location records, and backend ID validation.
- `v4.17` (2026-07-17): Made the profile description optional while retaining its 100-word limit when supplied.
- `v4.18` (2026-07-17): Added Dashboard, The Algorithm, and Find navigation/pages; Dashboard is now the post-onboarding destination, and Find supports exact user-ID profile lookup.
