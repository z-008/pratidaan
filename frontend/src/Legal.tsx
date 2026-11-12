/**
 * Privacy policy and terms. Public: Microsoft Entra consent links here before anyone signs in.
 * A mock policy for the demo, clearly marked as one, that says the same as Drop's Intro and the
 * "Your data" screen: what is kept where and for how long, the Choices, and how to delete it.
 */
import { Icon } from './ui';

const CONTACT = 'sandeepsamant1702@gmail.com';
const UPDATED = '12 November 2026';

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
      <span><b>Preview policy.</b> Pratidaan is a prototype preview with made-up blood donation records. This page says what the app does with your data, in plain words. It has not had a legal review.</span>
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
      <p><b>With your Microsoft account</b>, in private Azure Blob Storage:</p>
      <ul>
        <li>your name and email address from Microsoft sign-in;</li>
        <li>your sign-in history: the time and browser of each sign-in;</li>
        <li>when donating suits you: the days, times and place you choose (if you let this device share your location, it is rounded to about 1 km);</li>
        <li>your donation bookings, including cancelled ones (cancelling keeps the record).</li>
      </ul>
      <p>These stay until you delete them, or your account, in Your data.</p>

      <p><b>In your own Microsoft account</b>, only if you connect Microsoft Calendar when you book: a Calendar event for each booking, and a confirmation email sent through Microsoft Graph to yourself. Pratidaan can remove its Calendar events when you allow Calendar access again, but it cannot read or delete your email.</p>

      <p><b>With the donor profile you are viewing</b>, in Pratidaan's server memory: your Choices, things you ask Drop to remember (never health facts, religion, caste or income), readings you add, and values read from lab reports. Shared preview donors can be seen and changed by others using this preview, and all of it resets when the timeline resets. Lab report photos are not kept: they are sent to the AI to read, then discarded.</p>

      <p><b>Sent to Azure OpenAI</b>: what you type to Drop, lab report photos, and the donor records Drop needs to answer. It never gets your name or email. Microsoft states that prompts and outputs are not used to train foundation models. Abuse-monitoring retention depends on the Azure OpenAI configuration; this preview assumes up to 30 days.</p>

      <p><b>Server logs</b> (Azure App Service): capped rolling application logs used to find errors and stop misuse. They are not sent to a paid analytics workspace.</p>

      <p><b>This browser</b> remembers which donor you viewed and Drop lines you hid. A sign-in cookie keeps you signed in for 1 day, or until you sign out. Microsoft sign-in follows Microsoft's privacy policy.</p>

      <h2>Your choices</h2>
      <p>Three switches, which you can change any time in Your data, Health cover or Community:</p>
      <ul>
        <li><b>Share my health score with my insurer</b> (off unless you turn it on). Only the score, never your results. It can raise your cover at the same premium. In this preview no insurer receives anything.</li>
        <li><b>Show me on my Circles' leaderboards</b> (on). Your first name, donations and patients helped.</li>
        <li><b>Count my donations in my Circles' totals</b> (on). Anonymous numbers only; off, you are left out of every total.</li>
      </ul>

      <h2>How we use it</h2>
      <p>To sign you in, show you where your blood went and what your results mean, help you book, and keep a record of access. We don't sell your data, show ads, or share it with anyone except the Azure services that run Pratidaan.</p>

      <h2>Deleting your data</h2>
      <p>Open <b>Your data</b> in the account menu. Delete any item with its button, or delete your whole account: your profile, sign-in history, donation preferences and bookings go straight away, and you can also remove Calendar events Pratidaan added. You delete confirmation emails yourself and can remove Pratidaan's access in your Microsoft Account privacy settings.</p>
      <p>To get a copy of your data, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>

      <h2>Where it runs</h2>
      <p>Pratidaan runs on Microsoft Azure. The app and storage are deployed to the selected India Azure region; Azure OpenAI may use another configured Azure region where the model is available.</p>

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
      <p>Pratidaan is a demonstration of tracing blood donations and following up on the health check that comes with each one. You need a Microsoft account to sign in. Use it lawfully and do not try to access data or accounts that are not yours.</p>
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
