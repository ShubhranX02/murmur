# Murmur publication guide

This is the release checklist for taking Murmur from a local MVP to a safe, supportable public product. Complete the steps in order. Items marked **implemented** are in the repository but still require deployment configuration and verification. Items marked **owner action** need access to accounts, legal advice, or operational decisions that source code cannot provide.

## 1. Establish the launch boundary

1. **Owner action:** Choose the first release audience, countries, supported devices/browsers, support hours, expected member count, and whether the release is a closed beta or public launch.
2. **Owner action:** Choose an age policy before admitting users. The recommended initial policy is adults-only (18+) until age assurance, safeguarding, and age-appropriate matching have been designed and independently reviewed.
3. **Owner action:** Appoint an owner for security, privacy, moderation, incident response, and support. A social/messaging product cannot safely launch without named operators.
4. Record these decisions in the launch ticket and do not move to public launch until all later gates are signed off.

## 2. Configure production accounts and secrets

1. **Owner action:** Create separate Google Cloud, Firebase, Render, and Vercel projects/environments for development, staging, and production.
2. **Owner action:** Enable Firestore and YouTube Data API v3 in the production Google project. Restrict all API keys to their required APIs, referrers, and IPs; remove unused keys.
3. **Owner action:** Create a Google OAuth Web client. Configure only the final production domain (and approved staging domain) as JavaScript origins/redirect targets.
4. **Implemented — configure it:** Generate and store these Render secrets, never in source control:

   ```bash
   openssl rand -base64 48       # SESSION_JWT_SECRET
   openssl rand -base64 32       # YOUTUBE_TOKEN_ENCRYPTION_KEY
   ```

5. **Implemented — configure it:** Set `CORS_ORIGINS=https://app.example.com` on Render. List exact comma-separated origins; never use `*`.
6. **Owner action:** Give the Render Firebase service account only the permissions required for server-side Firestore access. Store it in Render’s secret store/file mechanism, not in Vercel or Git.
7. **Owner action:** Rotate any credential that may have been used in local files, commits, screenshots, or logs. Enable repository secret scanning and branch protection.

## 3. Deploy access controls

1. **Implemented:** Google ID tokens are verified server-side for signature, audience, expiry, and issuer using Google’s official library.
2. **Implemented:** The API issues a 12-hour signed bearer session after successful sign-in; all protected endpoints derive the acting user from it rather than a request body field.
3. **Implemented:** YouTube access tokens are encrypted with AES-256-GCM before being stored in Firestore and are no longer kept in process memory.
4. **Implemented:** Chat, group, profile-edit, matching, room, and message routes enforce member ownership or membership checks.
5. **Implemented — deploy it:** Deploy `firestore.rules` with Firebase CLI from the production Firebase project. Its deny-all policy is intentional: only the Express API’s Admin SDK may access Firestore.
6. **Owner action:** Test two separate accounts in staging. Confirm one cannot request, update, message, join, delete, or mark read resources owned by the other unless the product rules explicitly permit it.
7. **Owner action:** Have an independent security reviewer run an authorization test (including ID substitution and direct API requests) before launch.

## 4. Protect the API and browser surface

1. **Implemented:** Helmet security headers, a 200 KB JSON limit, exact-origin CORS, a general API rate limit, and a tighter sign-in rate limit are enabled.
2. **Owner action:** Put the API behind Render’s HTTPS endpoint or an equivalent managed edge. Enable a custom domain, TLS renewal, and a web application firewall/CDN if available.
3. **Owner action:** Tune rate limits using staging/load-test results; add account/IP throttles, bot protection, and challenge flows where abuse occurs.
4. **Owner action:** Set an explicit Content Security Policy on the Vercel frontend that permits only required Google Identity scripts, the production API, and approved image origins. Test Google sign-in after enabling it.
5. **Owner action:** Add a dependency-update process (Dependabot/Renovate plus weekly review). Resolve the current npm audit findings before public launch; the Transformers/ONNX path requires compatibility testing rather than a forced upgrade.

## 5. Validate product data and lifecycle

1. **Implemented:** Profile locations, age, gender, description, room capacity, room duration, and message sizes are server-validated.
2. **Owner action:** Add account deletion, data export, YouTube disconnect, and consent withdrawal endpoints/UI. Delete or anonymize associated profiles, deliveries, chats, rooms, messages, encrypted tokens, backups, and derived embeddings according to a documented retention schedule.
3. **Owner action:** Define a retention period for messages, rooms, profiles, audit logs, backups, and embeddings. Add scheduled cleanup/TTL processes and restore tests.
4. **Owner action:** Confirm the use and retention of liked-video data, saved titles, subscriptions, categories, and embeddings meets current YouTube API Services Terms and Google Limited Use requirements.

## 6. Complete trust, safety, and legal work

1. **Owner action:** Publish a Privacy Policy, Terms of Service, Community Guidelines, acceptable-use policy, moderation policy, and reachable support contact before onboarding anyone publicly.
2. **Owner action:** Add consent language before the YouTube OAuth action explaining accessed data, matching use, storage, profile visibility, and withdrawal/deletion choices.
3. **Owner action:** Build block, report, mute, room-admin, group-removal, moderation queue, suspension, appeal, and emergency escalation workflows.
4. **Owner action:** Train moderators, define service-level targets, preserve only necessary evidence, and create an incident-response runbook.
5. **Owner action:** Complete a privacy impact assessment with qualified legal/privacy counsel for the launch jurisdictions, especially if minors are in scope.

## 7. Make matching and data access production-ready

1. **Owner action:** Establish expected latency/cost budgets for YouTube ingestion and embeddings. Prewarm/package the model, set queueing/timeouts/retries, and handle empty likes, revoked grants, quota errors, and model failure gracefully.
2. **Owner action:** Replace full-collection member scans with indexed category retrieval and vector/ANN search before membership grows materially. Add cursor pagination and Firestore indexes.
3. **Owner action:** Replace Discover’s all-room substring scan with indexed prefix/token search or a dedicated search service at scale.
4. **Owner action:** Make match delivery and related writes transactional/idempotent; test concurrent onboarding and daily-delivery races.

## 8. Test, observe, and operate

1. **Implemented:** Run `npm test` for session-signature and encrypted-token regression checks. Run `npm run build` before every deployment.
2. **Owner action:** Add integration tests with Firestore Emulator and end-to-end tests covering Google sign-in, onboarding, YouTube failures, profile access, matches, chats, rooms, reporting/blocking, deletion, and session expiry.
3. **Owner action:** Run accessibility testing (keyboard, screen reader, contrast, zoom), browser/mobile testing, load testing, and a penetration test in staging.
4. **Owner action:** Add PII-redacted structured logs, error tracking, uptime checks, latency/cost dashboards, alerts, backups, restore drills, deployment rollback, and incident runbooks.
5. **Owner action:** Run a small, moderated beta. Do not expose the public URL until critical defects, abuse workflows, and support processes are proven.

## 9. Final go/no-go gate

1. Verify all production secrets and exact CORS origins are set.
2. Verify Firestore deny-all rules are deployed and the backend still works through Admin SDK.
3. Confirm OAuth consent-screen publishing/verification, YouTube scope approval, branding, privacy links, quota, and production origins with Google.
4. Confirm all critical/high dependency vulnerabilities are resolved or have written compensating controls approved by the security owner.
5. Confirm legal policies, deletion/consent controls, age policy, moderation staff, support channel, monitoring, and rollback are live.
6. Run the full automated and manual staging checklist with two accounts and record results.
7. Obtain written launch approval from the product, security, privacy/legal, and operations owners. Only then deploy to the public domain.
