/** The doctor's line that always goes with food coaching (fixed text from the rules); its colour says how soon. */
import type { WbDoctor } from '../../api';
import { Icon } from '../../ui';

const TITLE: Record<WbDoctor['urgency'], string> = {
  recommended: 'A doctor\'s check is recommended', weeks: 'See a doctor within 3 weeks', first: 'See a doctor first', today: 'See a doctor today',
};

export default function DoctorBanner({ doctor, onBook }: { doctor: WbDoctor | null; onBook?: () => void }) {
  if (!doctor) return null;
  return (
    <div className={`wb-doctor ${doctor.urgency}`} role={doctor.urgency === 'first' || doctor.urgency === 'today' ? 'alert' : undefined}>
      <Icon name="doctor" size={18} />
      {/* The title only when the text doesn't already start with it */}
      <span className="grow">{!doctor.text.startsWith(TITLE[doctor.urgency]) && <b>{TITLE[doctor.urgency]}</b>}{doctor.text}</span>
      {onBook && <button className="btn btn-sm" onClick={onBook}>Book a demo check-up</button>}
    </div>
  );
}
