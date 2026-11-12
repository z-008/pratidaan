/**
 * Privacy policy and terms. Public: Google's consent screen links here before anyone signs in.
 * A mock policy for the demo, clearly marked as one, that says the same as Drop's Intro and the
 * "Your data" screen: what is kept where and for how long, the Choices, and how to delete it.
 */
import { Icon } from './ui';

const CONTACT = 'sandeepsamant1702@gmail.com';
const UPDATED = '14 October 2026';

export const LEGAL_PATHS = ['/privacy', '/terms'];

export function LegalLinks() {
  return (
    <p className="tiny muted legal-links">
      By continuing you agree to the <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.
    </p>
  );
}

function DemoNote() {
  return (
    <div className="callout callout-warn small legal-demo">
      <Icon name="info" size={16} />
      <span><b>Preview policy.</b> Pratidaan is a hackathon preview with made-up blood donation records. This page says what the app does with your data, in plain words. It has not had a legal review.</span>
    </div>
  );
}

function Privacy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="tiny muted">Last updated {UPDATED}</p>
      <DemoNote />

      <h2>What we keep, where, and for how long</h2>
      <p><b>With your Google account</b>, in a Google Cloud database (Firestore):</p>
      <ul>
        <li>your name, email address and profile photo from Google sign-in;</li>
        <li>your sign-in history: the time and browser of each sign-in;</li>
        <li>when donating suits you: the days, times and place you choose (if you let this device share your location, it is rounded to about 1 km);</li>
        <li>your donation bookings, including cancelled ones (cancelling keeps the record).</li>
      </ul>
      <p>These stay until you delete them, or your account, in Your data.</p>

      <p><b>In your own Google account</b>, only if you connect Google Calendar when you book: a Calendar event for each booking, and a confirmation email sent from your Gmail to yourself. Pratidaan can remove its Calendar events when you allow Calendar access again, but it can't read or delete your email.</p>

      <p><b>With the donor profile you are viewing</b>, in Pratidaan's server memory: your Choices, things you ask Drop to remember (never health facts, religion, caste or income), readings you add, and values read from lab reports. Shared preview donors can be seen and changed by others using this preview, and all of it resets when the timeline resets. Lab report photos are not kept: they are sent to the AI to read, then discarded.</p>

      <p><b>Sent to Google's Gemini AI</b> (Google Cloud Vertex AI): what you type to Drop, lab report photos, and the donor records Drop needs to answer. It never gets your name or email. Google doesn't train its AI on it. Google may keep it in memory for up to 24 hours to answer faster, and for up to 90 days if its automated checks flag it for possible abuse. We don't promise which country this processing happens in.</p>

      <p><b>Server logs</b> (Google Cloud Logging): the pages and actions you used, your IP address and browser, kept for 30 days to find errors and stop misuse, then deleted automatically.</p>

      <p><b>This browser</b> remembers which donor you viewed and Drop lines you hid. A sign-in cookie keeps you signed in for 1 day, or until you sign out. Pratidaan sets no other cookies; Google's sign-in button follows Google's own privacy policy.</p>

      <h2>Your choices</h2>
      <p>Three switches, which you can change any time in Your data, Health cover or Community:</p>
      <ul>
        <li><b>Share my health score with my insurer</b> (off unless you turn it on). Only the score, never your results. It can raise your cover at the same premium. In this preview no insurer receives anything.</li>
        <li><b>Show me on my Circles' leaderboards</b> (on). Your first name, donations and patients helped.</li>
        <li><b>Count my donations in my Circles' totals</b> (on). Anonymous numbers only; off, you are left out of every total.</li>
      </ul>

      <h2>How we use it</h2>
      <p>To sign you in, show you where your blood went and what your results mean, help you book, and keep a record of access. We don't sell your data, show ads, or share it with anyone except the Google services that run Pratidaan.</p>

      <h2>Deleting your data</h2>
      <p>Open <b>Your data</b> in the account menu. Delete any item with its button (you have a few seconds to undo), or delete your whole account: your profile, sign-in history, donation preferences and bookings go straight away (upcoming bookings are cancelled first), and you can also remove the Calendar events Pratidaan added. Gemini's copies and server logs delete themselves (within 24 hours or 90 days, and 30 days). You delete the confirmation emails in your Gmail yourself, and you can remove Pratidaan's access in your Google Account under Security, Third-party connections.</p>
      <p>To get a copy of your data, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>

      <h2>Where it runs</h2>
      <p>Pratidaan runs on Google Cloud. Its app server runs in India (asia-south1). We make no promise about the country where the database keeps your data or where Google processes the AI requests and keeps its copies.</p>

      <h2>Contact</h2>
      <p><a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="tiny muted">Last updated {UPDATED}</p>
      <DemoNote />
      <h2>Using Pratidaan</h2>
      <p>Pratidaan is a demonstration of tracing blood donations and following up on the health check that comes with each one. You need a Google account to sign in. Use it lawfully and do not try to access data or accounts that are not yours.</p>
      <h2>Preview donor profiles</h2>
      <p>The donors you can view are made up, apart from the New donor, which stands for you as a new user. Everyone using this preview shares them, so what you enter can be seen and changed by others, and it all resets when the timeline resets. Don't enter anything you wouldn't want others to see.</p>
      <h2>Your content</h2>
      <p>You are responsible for what you enter. Do not upload real medical records, or anyone else's personal data without their consent.</p>
      <h2>No medical advice</h2>
      <p>Drop's answers and the health findings are for information only. They are not medical advice and do not replace a doctor. Bookings, insurance cover and health records shown here are illustrations: no blood centre, clinic or insurer receives anything.</p>
      <h2>Availability</h2>
      <p>Pratidaan is provided as is, without warranty. It may change, pause or stop at any time, and we may end access for anyone who misuses it.</p>
      <h2>Privacy</h2>
      <p>How we handle your data is described in the <a href="/privacy">Privacy Policy</a>, and you can see and delete it in Your data.</p>
      <h2>Contact</h2>
      <p><a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
    </>
  );
}

export default function Legal({ path }: { path: string }) {
  return (
    <div className="login">
      <article className="login-card legal">
        <a href="/" className="brand"><span className="brand-mark"><Icon name="drop" size={18} stroke={2.4} /></span>Pratidaan</a>
        {path === '/terms' ? <Terms /> : <Privacy />}
        <p className="tiny muted legal-links"><a href="/">Back to sign in</a> · <a href={path === '/terms' ? '/privacy' : '/terms'}>{path === '/terms' ? 'Privacy Policy' : 'Terms of Service'}</a></p>
      </article>
    </div>
  );
}
