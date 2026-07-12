# Original User Requests

## 2026-07-12T17:55:20Z

Fix all production-blocking issues identified in the RGIT Rozgar (BErozgar) audit report. The site is a campus exchange platform deployed at https://rgitrozgar.in. This is a production fix — every change must result in a deployable, functional website with no contradictory data, no fabricated metrics, proper accessibility, and correct security practices.

Working directory: c:\Users\praja\OneDrive\Desktop\Berozgar\unified-experience
Integrity mode: development

## Requirements

### R1. Remove all hardcoded/fabricated data and fix data integrity

The audit found that multiple pages display hardcoded fake data instead of real API-driven content. Fix ALL of the following:

**AccommodationPage.tsx:**
- The `areas` array (lines 26-30) hardcodes zone listings: 45, 32, 28 with fake signal percentages 98%/85%/72%. These must be removed or derived from real API data.
- Hero stats (lines 396-416) hardcode `105` active listings, `3` coverage zones, `100%` verified. These must show real counts from the listings API, or show an honest empty state when no data exists.
- Ticker data (lines 61-69) contains fabricated claims: `'ENCRYPTION: AES-256'`, `'LAST_SYNC: JUST NOW'`, `'ZONES: 3 OPERATIONAL'`, `'STATUS: OPERATIONAL'`. Remove all unsubstantiated operational/security claims.
- Console typewriter lines (lines 39-51) hardcode `'> ZONE_A: 45 listings detected'` etc. Remove or replace with real data.

**CampusEventsSection.tsx:**
- ALL 5 events (lines 7-48) are hardcoded with dates from March-May 2026, displayed as "UPCOMING" when it's July 2026. Either: (a) derive event status from stored timestamps (upcoming/past/live), or (b) remove the events section entirely if no event API exists. Do NOT show past events as "upcoming".

**ProfilePage.tsx — counter mismatch:**
- The Activity Summary shows `listingsCount` from the profile API (`user._count.listings` in `server/src/services/profileService.ts` line 110), while the "MY LISTINGS" section shows `listings.length` from a separate `/api/listings?ownerId=...` call. These use different queries and can disagree. Make both use the same source of truth — the actual fetched listings array length.

**Module numbering conflicts:**
- MasterExperience.tsx shows: 01=Academics, 02=Accommodation, 03=Essentials, 04=Resale
- But AcademicsPage says "Module 04" and ResalePage says "Module 01" — these are swapped
- Standardize numbering consistently across all files.

### R2. Fix security and pre-authentication messaging

**Seed script — `server/prisma/seed.ts`:**
- The seed script has NO environment guard. Add a check at the top: if `NODE_ENV === 'production'`, throw an error and abort. This prevents accidental seeding of the production database.
- The script also has hardcoded passwords (`Admin@1234`, `Seller@1234`, `Buyer@1234`) — add a comment warning these are dev-only.

**LoginPage.tsx pre-auth messaging:**
- Line 144-146: The heading "Identity Verified" appears BEFORE the user has logged in. Change to neutral copy like "Secure Sign In" or "Welcome Back".
- The Lanyard component (rendered on login page) shows "ADMINISTRATOR", "LEVEL 5 OMNI", and "Authorized Identity" to unauthenticated visitors. Change these to neutral/branded text that doesn't imply admin access (e.g., "CAMPUS MEMBER", "BErozgar Identity").

**Verification vocabulary consistency (`ProfilePage.tsx`, `CollegeVerificationBanner.tsx`, `src/domain/profile.ts`):**
- A user currently sees "PUBLIC USER" badge + "Verified" identity status + "Verify your college email" banner simultaneously on the same page. Fix the identity display to show ONLY the institution verification status (not the generic `user.verified` boolean). When role is `public_user`, do NOT show "Verified" anywhere — show "Unverified" or "Email Verified · College Pending" to make the distinction clear.

### R3. Fix performance — remove animation gates on LCP content

**LandingPage.tsx (logged-out homepage):**
- Hero text lines start at `opacity: 0` (lines 272, 280, 288) and are revealed by GSAP animation. There's also a full-screen loader overlay at z-100 that blocks everything for ~1.5 seconds. This causes LCP of ~5 seconds.
- Fix: Remove the loader overlay or make it non-blocking. Set hero text initial opacity to 1 (let CSS animations enhance, not gate). The hero MUST be visible as semantic HTML without JavaScript.
- Add a `<noscript>` fallback or ensure CSS `prefers-reduced-motion` forces content visible (the CSS already does this for `.animate-fade-in-up` but NOT for the loader overlay or inline `style={{ opacity: 0 }}`).

**MasterExperience.tsx (authenticated home):**
- Module cards container starts at `opacity-0 pointer-events-none` (line 300) and is revealed by GSAP ScrollTrigger. If GSAP fails, content is permanently invisible and unclickable.
- Fix: Remove `opacity-0` and `pointer-events-none` from the initial className. Let GSAP enhance the entrance animation progressively — content must be visible without JS.
- The three h1 elements (lines 254, 261, 274) also use `style={{ opacity: 0 }}` with CSS animation — ensure the reduced-motion CSS override works, and add `style={{ opacity: 1 }}` as a safe inline default that the animation overrides.

### R4. Fix accessibility issues

**Heading hierarchy:**
- MasterExperience.tsx has THREE separate `<h1>` tags ("TRUST", "CENTRIC", "EXCHANGE") — combine into ONE `<h1>` wrapping all three words.
- ProfilePage.tsx has TWO `<h1>` tags (lines 628, 876) — keep only one.
- LoginPage.tsx has a decorative h1 "TRUST" at 5% opacity (line 131) — change to `<span>` or `<div>`, it's not the page heading.
- Module cards use `<h3>` but there's no `<h2>` before them — fix heading hierarchy.

**Semantic navigation:**
- Module cards in MasterExperience.tsx use `<div role="button" onClick={navigate}>` instead of `<Link>`. Change to `<Link to={module.path}>` so users get native link behavior (right-click, open in new tab, link preview).
- Footer policy labels ("Privacy", "Security", "Governance") are `<span>` elements in FooterSection.tsx — either make them real `<a>` links to policy pages, or remove them entirely if no policy pages exist.
- Footer module quick-links ("Resale", "Accommodation", etc.) are also dead `<span>` — make them `<Link>` elements.

**Mobile notifications:**
- NotificationCenter in ContextNav.tsx (line 318) is wrapped in `hidden sm:block` — completely hidden on mobile. Make it visible on mobile, either in the top bar or as an item in the fullscreen menu.

**Forms:**
- Add a password visibility toggle (Eye/EyeOff icon) to both LoginPage and SignupPage password fields.
- Add error focus handling: after form submission failure, focus the first invalid field.

**Contrast:**
- Footer text uses `text-portal-foreground/30` which is ~3.0:1 contrast ratio on dark backgrounds — increase to at least `text-portal-foreground/60` for WCAG AA compliance.
- Review and fix any other text using opacity below /40 on dark backgrounds.

### R5. Fix UX issues — search persistence, pagination, and mobile

**Search/filter URL persistence:**
- ResalePage, AcademicsPage, and AccommodationPage all use `useState` for search and filter state. This means state is lost on page refresh, and URLs can't be shared with filters applied. Replace `useState` with `useSearchParams` from react-router-dom so that search query, category, sort order, and other filters persist in the URL.

**Profile listing pagination:**
- The profile page and module listing grids render ALL items at once with no pagination. Add a "Show More" button or simple pagination to listing grids — show 12 items initially, load more on demand.

**Verification banner persistence:**
- CollegeVerificationBanner dismissal is session-only (useState). Persist dismissal in localStorage so it doesn't return on every page refresh. Still show it once per session or with a "remind me later" approach.

**Remove decorative filler:**
- Remove "SCROLL TO EXPLORE" text from CampusEventsSection.tsx (line 215), MasterExperience.tsx (line 287), and AccommodationPage.tsx (line 467).
- Add Profile as a menu item in the fullscreen mobile menu overlay in ContextNav.tsx (it's currently only accessible via a small 32px avatar).

## Acceptance Criteria

### Data Integrity
- [ ] AccommodationPage shows real listing counts from the API (or honest zero/empty state) — no hardcoded 45/32/28/105 numbers
- [ ] No "AES-256", "LAST_SYNC: JUST NOW", or fabricated operational metrics appear anywhere in the rendered UI
- [ ] CampusEventsSection either shows events with correct temporal status (past events shown as "PAST" or "COMPLETED") or the section is removed
- [ ] ProfilePage Activity Summary "Listings" count matches the "MY LISTINGS — X TOTAL" count on the same page
- [ ] Module numbering is consistent between MasterExperience and individual module pages

### Security & Messaging
- [ ] `server/prisma/seed.ts` throws and aborts when `NODE_ENV === 'production'`
- [ ] LoginPage heading says "Secure Sign In" or equivalent neutral text — NOT "Identity Verified"
- [ ] Lanyard component on login page does NOT show "ADMINISTRATOR" or "LEVEL 5 OMNI" text
- [ ] ProfilePage for a `public_user` does NOT simultaneously show "Verified" alongside "Verify your college email" banner — vocabulary is consistent

### Performance
- [ ] Landing page hero text is visible in the initial HTML render without waiting for JavaScript animations (no `opacity: 0` initial state on LCP content)
- [ ] MasterExperience module cards are visible and clickable without GSAP — `opacity-0` and `pointer-events-none` are NOT in the initial className
- [ ] `npm run build` succeeds with 0 errors
- [ ] `cd server && npm run build` succeeds with 0 errors
- [ ] `cd server && npm test` passes all tests (93/93)

### Accessibility
- [ ] Each page has exactly ONE `<h1>` element
- [ ] No heading level is skipped (h1 → h2 → h3, never h1 → h3)
- [ ] Module cards in MasterExperience use `<Link>` (or `<a>`) instead of `<div onClick>`
- [ ] Footer policy labels are either real `<a>` links or removed
- [ ] Password visibility toggle exists on login and signup forms
- [ ] NotificationCenter is accessible on mobile (not hidden with `hidden sm:block`)
- [ ] No text in the UI has contrast ratio below 4.5:1 against its background (footer text opacity must be ≥ /50)

### UX
- [ ] Search and filter state on ResalePage, AcademicsPage, and AccommodationPage persists in URL query parameters via `useSearchParams`
- [ ] "SCROLL TO EXPLORE" text is removed from all 3 locations
- [ ] Profile is accessible from the fullscreen mobile menu
- [ ] CollegeVerificationBanner dismissal persists in localStorage

### Build Verification
- [ ] `npm run build` (frontend) completes with 0 errors
- [ ] `cd server && npm run build` completes with 0 errors
- [ ] `cd server && npm test` passes all existing tests
- [ ] No TypeScript errors in the build output
- [ ] `git push origin main` succeeds
