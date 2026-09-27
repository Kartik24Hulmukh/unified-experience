/**
 * BErozgar / RGIT Rozgar — Reviewed campus knowledge base (APODEX priority: Campus Q&A)
 *
 * HARD RULES (privacy council, continuation f §2):
 *  - Only human-reviewed, public, non-personal content lives here.
 *  - No student records, no CollegeStudent rows, no listing owner data,
 *    no phone numbers, no email addresses, no free-text scraped from users.
 *  - Every entry carries an explicit in-repo source so an answer can always
 *    be audited back to a reviewed document.
 *
 * This is deliberately a static, deterministic corpus rather than an LLM
 * ingestion pipeline: answers must be reproducible, citable and impossible to
 * poison from user-generated content.
 */

export interface KnowledgeEntry {
  id: string;
  question: string;
  answer: string;
  /** In-repo reviewed source document for audit. */
  source: string;
  topic: 'account' | 'exchange' | 'safety' | 'privacy' | 'directory' | 'support';
  keywords: string[];
}

export const CAMPUS_KNOWLEDGE: readonly KnowledgeEntry[] = [
  {
    id: 'verify-student',
    question: 'How do I get verified as an RGIT student?',
    answer:
      'Sign up with your college email address and complete the OTP sent to it. Verification is checked against the reviewed college student directory, so only a current student can reach listings, requests and chat. Until verification completes you can browse the public discovery strip but cannot post or message.',
    source: 'docs/SECURITY.md',
    topic: 'account',
    keywords: ['verify', 'verified', 'verification', 'student', 'signup', 'register', 'otp', 'college', 'email', 'account'],
  },
  {
    id: 'what-is-rozgar',
    question: 'What is RGIT Rozgar and what can I do here?',
    answer:
      'RGIT Rozgar is a single verified-student space for the campus: resale of books and gear, academics material, accommodation leads, and reviewed mess and hospital directories. Every exchange runs through a request thread between two verified students so there is an auditable record instead of an anonymous chat.',
    source: 'README.md',
    topic: 'account',
    keywords: ['what', 'rozgar', 'rgit', 'platform', 'about', 'features', 'modules', 'do'],
  },
  {
    id: 'create-listing',
    question: 'How do I post an item for resale?',
    answer:
      'Open the Resale module, choose Create Listing, add a title, category, price and photos, then submit. New listings enter review and become publicly discoverable only after they are approved, which is what keeps the public feed free of spam.',
    source: 'docs/ARCHITECTURE.md',
    topic: 'exchange',
    keywords: ['post', 'create', 'listing', 'sell', 'resale', 'upload', 'item', 'book', 'price', 'photo'],
  },
  {
    id: 'request-flow',
    question: 'How does an exchange request work end to end?',
    answer:
      'You send a request on a listing; the owner accepts or declines; an accepted request opens a request-scoped message thread; both sides then confirm completion. State changes are row-locked in PostgreSQL, so double clicks or retries cannot create duplicate or conflicting exchanges.',
    source: 'docs/ARCHITECTURE.md',
    topic: 'exchange',
    keywords: ['request', 'exchange', 'accept', 'decline', 'complete', 'flow', 'buy', 'chat', 'message', 'thread'],
  },
  {
    id: 'safe-meetup',
    question: 'Where should I meet to hand over an item?',
    answer:
      'Meet on campus, in daylight, in a public and busy spot such as the library approach, canteen or main gate. Keep the handover conversation inside the request thread so there is a record, check the item before paying, and never share OTPs, bank credentials or UPI PINs.',
    source: 'docs/SECURITY.md',
    topic: 'safety',
    keywords: ['meet', 'meetup', 'handover', 'safe', 'safety', 'where', 'campus', 'cash', 'pay', 'payment', 'scam'],
  },
  {
    id: 'report-fraud',
    question: 'Someone is behaving suspiciously — how do I report it?',
    answer:
      'Use Report on the listing or inside the request thread. Reports open a dispute record that moderators see with the full thread history and the trust signals for both accounts. Repeated confirmed reports restrict an account from posting and requesting.',
    source: 'docs/SECURITY.md',
    topic: 'support',
    keywords: ['report', 'fraud', 'scam', 'suspicious', 'dispute', 'cheat', 'fake', 'block', 'abuse', 'complaint'],
  },
  {
    id: 'trust-score',
    question: 'What is the trust score and how is it calculated?',
    answer:
      'Trust is derived from verifiable database facts only: completed exchanges, cancellation rate, dispute outcomes and account age. Client-side activity and vanity counters never feed it, so it cannot be inflated by refreshing pages or self-dealing.',
    source: 'docs/ARCHITECTURE.md',
    topic: 'exchange',
    keywords: ['trust', 'score', 'rating', 'reputation', 'stars', 'calculated', 'ranking'],
  },
  {
    id: 'privacy-public',
    question: 'What can people see about me before they log in?',
    answer:
      'Nothing personal. The signed-out discovery feed serves a narrow DTO: title, category, price and creation date. Owner identity, phone number, email, request threads and moderation state are never exposed on public endpoints.',
    source: 'docs/SECURITY.md',
    topic: 'privacy',
    keywords: ['privacy', 'public', 'visible', 'see', 'anonymous', 'data', 'pii', 'phone', 'email', 'profile', 'logged'],
  },
  {
    id: 'mess-directory',
    question: 'How do I find messes near campus?',
    answer:
      'The Mess module lists reviewed mess and tiffin options collected from the campus research document set, with the attributes that were actually verified. Entries come from reviewed documents, not from unverified user submissions, so listings stay trustworthy.',
    source: 'docs/Messes.docx',
    topic: 'directory',
    keywords: ['mess', 'tiffin', 'food', 'canteen', 'eat', 'meal', 'lunch', 'dinner', 'directory', 'near'],
  },
  {
    id: 'hospital-directory',
    question: 'Where is the nearest hospital or dispensary?',
    answer:
      'The Health module carries the reviewed hospitals and dispensaries directory for the campus area, including type and locality. For an emergency call 108 (ambulance) or 112 first — the directory is for planning, not triage.',
    source: 'docs/Hospitals & Dispensaries Research.docx',
    topic: 'directory',
    keywords: ['hospital', 'dispensary', 'clinic', 'doctor', 'medical', 'health', 'emergency', 'ambulance', 'sick', 'injury'],
  },
  {
    id: 'accommodation',
    question: 'Can I find a room, PG or flatmate here?',
    answer:
      'Yes — accommodation leads are posted as listings by verified students and follow the same request-and-thread flow. Visit in person before paying anything, and never transfer a deposit before seeing the room and the agreement.',
    source: 'docs/PRODUCTION_READINESS.md',
    topic: 'directory',
    keywords: ['room', 'pg', 'flat', 'hostel', 'accommodation', 'rent', 'roommate', 'flatmate', 'stay', 'deposit'],
  },
  {
    id: 'delete-account',
    question: 'How do I delete my account and my data?',
    answer:
      'Request deletion from Profile. Active listings are withdrawn, open requests are cancelled, and personal fields are erased; anonymised exchange counters are retained for dispute integrity. Analytics events are retained for at most 30 days.',
    source: 'docs/SECURITY.md',
    topic: 'privacy',
    keywords: ['delete', 'remove', 'account', 'data', 'erase', 'deactivate', 'gdpr', 'retention', 'close'],
  },
  {
    id: 'login-trouble',
    question: 'I cannot log in or my OTP never arrives — what now?',
    answer:
      'Check the spam folder and confirm you used the same college email you registered with; OTPs expire and are single use, so request a fresh one rather than reusing an old code. If sign-in still fails, report it from the login screen so the failure is captured with a correlation id.',
    source: 'docs/TESTING_GUIDE.md',
    topic: 'support',
    keywords: ['login', 'log', 'signin', 'otp', 'code', 'password', 'locked', 'cannot', 'failed', 'reset'],
  },
  {
    id: 'fees-free',
    question: 'Does RGIT Rozgar charge any commission?',
    answer:
      'No. The platform does not process payments and takes no commission; students settle directly at handover. Anyone asking you to pay a platform fee, a listing boost or a release charge is attempting fraud — report it.',
    source: 'README.md',
    topic: 'safety',
    keywords: ['fee', 'fees', 'commission', 'charge', 'free', 'cost', 'payment', 'money', 'pay', 'price'],
  },
];
