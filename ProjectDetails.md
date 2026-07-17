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
7. The user enters the Dashboard, then can use the leftmost navigation search icon to find a member by Murmur ID; use Discover to open a category or title-search results view of public conversations they have not already joined; and access The Algorithm, Conversations, Matches, Dashboard, and their profile from the navigation bar.

The app currently displays version `v4.57` in the top-right of the navigation bar. Increment `src/config/appVersion.js` for every code change using two-digit minor versions: `4.58`, `4.59`, … `4.99`, after which it rolls over to `5.00`. Report the new version number to the user whenever a code change is delivered.

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
| `/find` | `FindPage` | Discover category cards and start a public-conversation title search |
| `/find/:categoryId` | `FindPage` | Separate public, unjoined-conversation results view for a selected category or title search, with a Back to categories action |
| `/matches` | `MatchesPage` | WhatsApp-style two-pane chat workspace; select a direct match or group to open its conversation, or use the Chats-header plus button to create a group |
| `/matches/:matchId` | `MatchesPage` | Opens a selected direct match or group in the workspace chat panel |
| `/dashboard` | `DashboardPage` | Default post-onboarding page with a near-full-width 3-by-2 grid of taller widgets; its top-left card uses larger welcome content, top-centre card gives its Total Matches and Today’s Matches halves matching label treatment and roomy spacing, and top-right card centres a large profile avatar above the member’s name, age, gender, and location |
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
2. Murmur treats YouTube data as current for seven days. On local-session restoration, expired or missing YouTube data clears the session and requires a new Google sign-in. On sign-in, the backend marks a profile with missing or week-old data as requiring refresh; those members are sent to onboarding, where they can reconnect YouTube or continue with their saved taste profile.
3. New users see the welcome screen and **Connect YouTube** button on the same screen. There is no separate YouTube tab.
4. Google OAuth requests `https://www.googleapis.com/auth/youtube.readonly`.
5. The app stores the short-lived access token in the backend’s in-memory token store.
6. It fetches current YouTube data. A returning member sees **Reconnect YouTube for latest data** and, after a weekly refresh prompt, can instead choose **Continue with saved taste profile**. The Start a Conversation window also offers a manual **Refresh YouTube data** action.
7. A new member must select a City in India from the local searchable Class X/Class Y list, then supplies Age (13–120), Gender (Male, Female, or Other), and may add a description of at most 100 words before their first match calculation. This lets location and age influence initial recommendations.
8. The server then builds the taste profile, delivers up to five initial matches, and shows the completion/match-count screen.
8. Completing onboarding, visiting the landing page while already fully onboarded, or signing in as a fully onboarded user takes the member to `/dashboard`.

### Standardised Indian locations

Murmur uses the local `src/data/indiaXyCities.json` snapshot for every location selection. It contains 99 eligible 2011 Census urban locations: 8 Class X locations (population of 50 lakh or more) and 91 Class Y locations (5 lakh to below 50 lakh). The source baseline is the Office of the Registrar General & Census Commissioner, India’s [2011 A-04 town and urban-agglomeration table](https://censusindia.gov.in/nada/index.php/catalog/42876) and [Urban Agglomeration Primary Census Abstract](https://censusindia.gov.in/nada/index.php/catalog/45261/study-description).

Each list entry has an app-stable canonical `id`, canonical `city`, `state`, `country: "India"`, and `tier`; selected entries may also be found through legacy-name aliases such as Bangalore. The app sends the selected ID, but the backend treats that ID as authoritative and replaces the client-supplied city/state/country/tier values with the canonical local record before saving. This prevents misspellings, arbitrary locations, and forged display metadata from entering Firestore.

The reusable `IndiaLocationPicker` is used both during onboarding and on a member’s profile-edit screen. Older profiles with free-text locations are preserved for display, but a member must select an eligible canonical location when they next save their details.

Profiles use a page-based architecture rather than an in-place profile panel. The signed-in user can edit their own details at `/profile`; clicking a matched member's avatar/name in the Chats list or conversation header opens `/profile/:userId`. Each profile subtly shows its Firestore member ID. A non-owner viewing a profile sees **Message** when already matched, or **Add to matches** when eligible but not yet in their Matches list. Every onboarded profile displays its aggregate liked-video count, number of analysed categories, and category-breakdown chart. Public profiles never return email addresses, raw YouTube data, or embeddings.

The Google client ID is resolved in this order:

1. `VITE_GOOGLE_CLIENT_ID`, if present.
2. `GET /api/auth/google-client-id` from the configured Render API.

The second option is preferable for deployed environments because `GOOGLE_CLIENT_ID` remains the single source of configuration. OAuth client IDs are public identifiers and are safe to return to the browser.

### UI components

- `Navbar`: fixed top navigation whose leftmost option is a search icon that opens a member-ID search window; its remaining links are ordered The Algorithm, Discover, Conversations, Matches, and Dashboard. A clickable user avatar opens Profile, and a version badge is shown alongside the links. Desktop and mobile link gaps are increased by 25% from their prior values.
- `Discover`: shows a video-title search bar above category cards for All Conversations plus every category supported by the current YouTube mapping. The square category cards retain a broad, bright always-on glow matching their unique label colour, which intensifies on hover/focus; the grid gap prevents neighbouring glows from colliding. The desktop grid uses four cards per row; selecting a category or submitting a title search opens a separate results view with a Back to categories action. It lists only accessible, recency-sorted public rooms the member has not already joined, each with a **Join** action.
- `Conversations`: its sub-heading explains that it lists conversations started by matches and those joined from **Discover**, which remains an inline link to `/find`. Starting a conversation lets the creator select a total capacity of 2–30 people and set its audience to **Public** or **Matches Only**.
- `MatchCard`: clickable match row with a score tooltip; list avatars are shown without a colored border.
- `MatchScore`: reusable, keyboard-accessible score display. Hovering or focusing it explains how Murmur calculates a match score.
- `PercentageRing`: animated SVG compatibility percentage.
- `ChatBubble`: sent/received chat-message display.
- `LoadingSpinner`: shared progress indicator.

The active design system is defined by CSS custom properties in `src/index.css`: deep navy background, red YouTube-inspired accent colors, glass cards, animation helpers, and shared button styles. Chat and Matches use the same visible doodle wallpaper over a black background. Every rendered match score uses the shared, keyboard-accessible `MatchScore` component and its hover/focus tooltip: “Your Match Score - an indicator of how much your tastes match. It is calculated with the help of your YouTube data and The Algorithm”.

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
| `GET` | `/profile/:userId` | None | Returns a public profile: name, avatar, onboarding state, profile details, liked-video analysis count, and category distribution; excludes email, raw YouTube data, and embeddings |
| `PATCH` | `/profile/:userId` | `{ "profileDetails": { "location": { "id" }, "age", "gender", "description" } }` | Validates the selected canonical Class X/Y ID, writes its canonical city/state/country/tier values, and marks `detailsComplete: true` |
| `POST` | `/youtube-refresh/skip` | `{ "userId" }` | Saves the returning member’s choice to continue with their last stored taste profile rather than refresh YouTube |

#### YouTube: `/api/youtube`

| Method | Endpoint | Request | Purpose |
| --- | --- | --- | --- |
| `POST` | `/fetch` | `{ "userId" }` | Uses the stored user token to fetch liked videos and subscriptions |

The endpoint currently retrieves up to four 50-item pages (200 likes and 200 subscriptions maximum). The server returns raw results plus `likedCount` and `subscriptionCount`.

#### Matching: `/api/matches`

| Method | Endpoint | Request | Purpose |
| --- | --- | --- | --- |
| `POST` | `/compute` | `{ "userId", "likedVideos", "subscriptions" }` | Builds and timestamps the current taste profile, refreshes category candidates, and delivers up to five initial matches for a newly onboarded member |
| `POST` | `/add` | `{ "userId", "otherUserId" }` | Adds an eligible discovered member to the requesting user’s Matches list and returns the calculated score |
| `GET` | `/:userId/:otherUserId` | None | Calculates the current user-to-user match score for display on a member profile |
| `GET` | `/:userId` | None | Returns delivered matches, annotating unread and not-yet-started chats; when eligible, delivers one new undiscovered match for the day |

The profile embedding uses the first 50 liked videos received from YouTube, intended to represent the user’s most recent tastes. Category statistics and subscription IDs still use all fetched data. A successful new YouTube analysis clears any prior refresh-skip choice.

#### Chat: `/api/chat`

| Method | Endpoint | Request | Purpose |
| --- | --- | --- | --- |
| `POST` | `/send` | `{ "chatId", "senderId", "text" }` | Creates a message and updates chat metadata |
| `POST` | `/groups` | `{ "creatorId", "name", "memberIds" }` | Creates a named group chat. Selected members must be matches of the creator; an empty selection creates a creator-only group. |
| `GET` | `/groups/:userId` | None | Returns group chats that include the member, including unread and started-conversation status |
| `GET` | `/:chatId/messages` | None | Fetches up to 100 messages, oldest first |
| `POST` | `/:chatId/read` | `{ "userId" }` | Marks the chat’s latest message as read for that user |

The navigation search window checks the existing public-profile endpoint before navigation. An empty, unknown, or unavailable ID presents the user-facing message `No such user exists`; a valid ID opens `/profile/:userId`.

#### Conversations: `/api/activities`

| Method | Endpoint | Request | Purpose |
| --- | --- | --- | --- |
| `POST` | `/create` | `{ "publisherId", "video", "participantLimit", "expiresInHours", "audience" }` | Creates a room with a 2–30 total-member capacity and either `public` or `matches` audience |
| `GET` | `/?userId=...` | None | Returns active rooms created by the member or their matches, plus rooms the member joined through Discover; newest first |
| `GET` | `/discover?userId=...&categoryId=...&q=...` | None | Returns live, joinable public rooms the member has not already joined, filtered by YouTube category and/or case-insensitive video-title substring; newest first |
| `POST` | `/:activityId/join` | `{ "userId" }` | Adds an eligible member to a room and permits them to enter its chatroom |
| `GET` | `/:activityId/details` | None | Returns a room and its participant profiles |
| `GET` | `/:activityId/messages` | None | Returns the room’s messages, oldest first |
| `POST` | `/:activityId/send` | `{ "senderId", "text" }` | Sends a message; the sender must already be a participant |
| `DELETE` | `/:activityId` | `{ "userId" }` | Lets the creator end a room |

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

### Match formula and delivery

`computeMatchScore(userA, userB)` combines two signals:

| Signal | Method | Weight |
| --- | --- | --- |
| Content vibe | Cosine similarity of user embeddings | 60% |
| Categories | Cosine similarity of normalized category distributions | 40% |

Murmur first calculates a `rawScore` as the direct weighted average of these percentages, then applies a continuous, monotonic piecewise-linear presentation scale. The transformation preserves the underlying compatibility calculation and ranking while making stronger matches read more positively:

| Raw score | Displayed score |
| --- | --- |
| 0–10% | 0–10% |
| 10–20% | 10–20% |
| 20–30% | 20–32% |
| 30–40% | 32–48% |
| 40–50% | 48–60% |
| 50–60% | 60–71% |
| 60–70% | 71–82% |
| 70–80% | 82–90% |
| 80–90% | 90–95% |
| 90–100% | 95–100% |

Candidate selection happens before this score is calculated: Murmur orders eligible members by same canonical location first, then members within a preferred age range of +/- 5 years, and uses category cosine similarity as a low-cost first pass. Only the top 25 priority/category candidates receive embedding/vector scoring. New match documents retain both the raw and displayed score; delivery records created before this scale were introduced are transformed when read, so existing members see the new scale immediately without a Firestore migration.

After first onboarding, up to five of those ranked candidates are delivered as the member’s initial matches. Thereafter, the first eligible visit each new UTC day delivers one previously undiscovered candidate if one is available. This is intentionally delivery-based rather than exposing an unlimited recalculated list, to encourage more meaningful conversations.

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
    topCategories,
    savedLikedVideos // Includes id, title, channel, thumbnail, and categoryId for room creation
  }
}
```

### `matches/{sortedUserIdA_sortedUserIdB}`

```js
{
  users: [userIdA, userIdB],
  score,                 // Positively skewed displayed score
  rawScore,              // Original 60/40 compatibility score
  scoreScaleVersion,
  embeddingScore,
  categoryScore,
  createdAt
}
```

### `matchDeliveries/{userId_otherUserId}`

Each recipient has a delivery record for the matches they are allowed to see. It stores the recipient and other member IDs, score snapshots, avatar/name display data, whether it was an initial introduction, and the delivery date/time. A member can also explicitly add an eligible profile they discover, which creates a delivery for that requesting member. The Matches API exposes the other member as `userId` (and the recipient separately as `recipientUserId`); every Matches-tab navigation path also explicitly prefers `otherUserId` for backwards-compatible profile and chat navigation. This collection supports the five-onboarding-match and one-new-match-per-day cadence without making every eligible score immediately visible.

### `activities/{activityId}` and `activities/{activityId}/messages/{messageId}`

Conversation rooms store the publisher, selected liked-video metadata (including its YouTube `categoryId`), participant IDs, expiry, and chat metadata. New rooms use `participantLimit` as a total capacity including the creator (2–30), while their legacy `limit` companion preserves compatibility with older clients. `audience` is either `public`, allowing any member to join through Discover, or `matches`, allowing only the creator’s matches. Older rooms without an audience are treated as matches-only.

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

Chat messages are retrieved with polling every three seconds in the frontend. The direct-match and group-chat list refreshes every ten seconds and highlights chats whose latest message was sent by the other person and has not been read, including chats created before unread tracking was added. Delivered matches with no sent chat message are additionally highlighted in yellow. The Matches page presents the chat list and active conversation in one desktop-style workspace; the plus button beside **Chats** opens a dialog for a group name and zero or more matched members. Before a chat is selected, its panel says “Click on any chat to message.” Firestore real-time listeners are not currently used.

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
7. **Define privacy and retention policy.** Member profiles now deliberately share aggregate liked-video counts and category breakdowns, while raw videos, subscriptions, email, and embeddings remain private. Add informed consent, deletion/export controls, retention rules, and secure Firestore rules before public launch.
8. **Add moderation and safety controls.** A people-matching product needs reporting, blocking, rate limiting, abuse prevention, and content moderation.
9. **Scale matching further.** The app now limits expensive embedding scoring to 25 category-selected candidates, but still reads eligible Firestore profiles to form that category shortlist. Use indexed category representations, vector search/ANN retrieval, and queued jobs as membership grows.
10. **Scale Discover search.** The MVP filters active public rooms in the backend to perform case-insensitive video-title substring results without exposing nonpublic rooms. As room volume grows, add a dedicated search service or an indexed token/prefix representation rather than scanning active room documents.
11. **Add tests.** There are currently no unit, integration, or end-to-end tests. Start with embedding/match-score tests, route tests, and an onboarding smoke test.

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
- `v4.19` (2026-07-17): Renamed the Find experience to Discover and increased navbar tab spacing by 20%.
- `v4.20` (2026-07-17): Expanded the Dashboard grid to the available page width and added the requested top-left welcome card with a The Algorithm link.
- `v4.21` (2026-07-17): Matched the Activities page width to Discover and The Algorithm, and removed the colored border around chat-list avatars.
- `v4.22` (2026-07-17): Added current match-score display to other-member profiles and standardized the explanatory score tooltip across match lists, chat headers, and profiles.
- `v4.23` (2026-07-17): Reviewed and confirmed the active project context, including Murmur's product vision, React/Express/Firebase architecture, YouTube ingestion, semantic matching, APIs, deployment model, and production priorities.
- `v4.24` (2026-07-17): Ensured current match scores display on other members’ profiles and standardized the requested hover/focus explanation across profile, chat-header, and match-list score displays.
- `v4.25` (2026-07-17): Moved match-score tooltips into a top-level layer so they remain visible above the Matches workspace, and removed the unused red unread/total-count toggle from the Chats sidebar.
- `v4.26` (2026-07-17): Increased the Dashboard widget height and replaced the top-right placeholder with a clickable preview of the signed-in member’s profile.
- `v4.27` (2026-07-17): Increased desktop and mobile navigation-link spacing by 25%.
- `v4.28` (2026-07-17): Added seven-day YouTube-data freshness enforcement and manual refresh, location/age-prioritised category-first matching, five initial plus daily delivered matches, Dashboard match details, and yellow highlights for unstarted conversations.
- `v4.29` (2026-07-17): Made Dashboard widgets taller, added Today’s Matches and arrows to its action links, expanded the profile preview details, and moved YouTube refresh into the Start a Conversation window.
- `v4.30` (2026-07-17): Increased Dashboard widget height through larger welcome content, roomier match details, and a centred large-avatar profile preview with details beneath it.
- `v4.31` (2026-07-17): Corrected delivered-match API identifiers so profile and chat links from Matches target the other member rather than the signed-in member.
- `v4.32` (2026-07-17): Added a client-side other-member-ID fallback for Matches navigation, protecting profile and chat links from older delivery-response shapes.
- `v4.33` (2026-07-17): Applied explicit other-member ID resolution to chat selection and active-chat profile links as well as match-list profile links.
- `v4.34` (2026-07-17): Restructured Dashboard bottom row: Activities link in bottom-left, empty placeholder in bottom-centre, Algorithm link with heading and description in bottom-right; removed Algorithm link from the welcome card.
- `v4.35` (2026-07-17): Completed project-context review, covering Murmur's product vision, React/Vite and Express architecture, Firebase/Firestore model, Google and YouTube integrations, semantic matching pipeline, APIs, deployment, and production priorities.
- `v4.36` (2026-07-17): Added a profile-level Add to matches action for eligible unconnected members, a persisted skip option for the weekly YouTube refresh prompt, and shared aggregate YouTube-analysis counts/category breakdowns on every member profile.
- `v4.37` (2026-07-17): Renamed the user-facing Activities tab and related page/dashboard labels to Conversations; the established `/activity` route and activities API remain unchanged for compatibility.
- `v4.38` (2026-07-18): Added the Conversations sub-heading and inline Discover link explaining the source of listed conversations.
- `v4.39` (2026-07-18): Removed the underline from the Discover link in the Conversations sub-heading.
- `v4.40` (2026-07-18): Added a continuous, ranking-preserving positive score scale that maps raw match scores to the requested more appealing displayed ranges and applies it to legacy deliveries at read time.
- `v4.41` (2026-07-18): Added named group chats to Matches: a Chats-header creation dialog, match-only invitations, persistent Firestore group records, group list entries, and group message delivery.
- `v4.42` (2026-07-18): Completed project-context review, including Murmur's product vision, React/Vite and Express architecture, Firestore data model, Google/YouTube integrations, semantic matching pipeline, APIs, deployment model, and production priorities.
- `v4.43` (2026-07-18): Completed and verified group chats in Matches, including the Chats-header creation control, group naming and match selection, protected group creation, persisted group-list entries, and group messaging.
- `v4.44` (2026-07-18): Moved exact member-ID lookup from Discover into a leftmost navigation search icon and modal search window; Discover is now intentionally empty.
- `v4.45` (2026-07-18): Restored the Conversations subheading's inline Discover link while retaining the intentionally empty Discover tab.
- `v4.46` (2026-07-18): Configured Discover for recency-sorted public and eligible matches-only video conversations, with all supported YouTube-category cards, video-title search, and direct room joining. Conversation creation now supports Public/Matches Only audiences and a 30-person total-room cap.
- `v4.47` (2026-07-18): Completed a project-context review covering Murmur's vision, React/Vite and Express architecture, Firebase/Firestore model, Google and YouTube integrations, semantic matching pipeline, APIs, deployment model, and production priorities.
- `v4.48` (2026-07-18): Restyled Discover category cards as square, page-toned tiles with a unique new text colour for every category; category-card backgrounds are now intentionally uniform rather than multicoloured.
- `v4.49` (2026-07-18): Changed Discover's All Conversations label to white and increased category-card label sizes on desktop and mobile.
- `v4.50` (2026-07-18): Moved Discover category and title-search results into their own routed view with a Back to categories action. Discover now exposes only live public rooms the member has not joined, excluding matches-only and already-joined conversations.
- `v4.51` (2026-07-18): Added persistent, category-coloured glows to Discover's square category cards and strengthened those glows on hover and keyboard focus.
- `v4.52` (2026-07-18): Made Discover category-card glows brighter and substantially broader, while increasing responsive card spacing so the square tiles' glows do not overlap.
- `v4.53` (2026-07-18): Reduced the maximum size and internal padding of Discover's square category tiles while retaining their bright, separated glows.
- `v4.54` (2026-07-18): Increased Discover category-tile spacing by 50% across desktop, tablet, and mobile layouts.
- `v4.55` (2026-07-18): Increased Discover category-tile spacing by a further 30% across desktop, tablet, and mobile layouts.
- `v4.56` (2026-07-18): Changed Discover's All Conversations tile label and glow from pure white to the warm off-white `#FEFCED`.
- `v4.57` (2026-07-18): Increased the spacing between Discover's category-search area and tile grid by 150%, without changing the separate results view spacing.
