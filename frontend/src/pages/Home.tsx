import { useEffect, useState } from 'react';
import { api, fmtDate, rupees, type AuthUser } from '../api';
import type { PageProps } from '../App';
import { ErrorNote, Icon, Loading, severityPill, useLoad } from '../ui';
import DropFeed from '../components/drop/DropFeed';
import Copilot, { bookCheckup, startBooking } from '../components/Copilot';
import { fmtVisitDay } from '../components/drop/Checkup';
import BadgeHomePreview from '../components/impact/BadgeHomePreview';
import { introFocus } from '../components/intro/Intro';

// The tiles each Intro step talks about; on the "Your data" step the account chip pulses instead
const INTRO_TILES: Record<string, string[]> = { journey: ['helped'], health: ['score', 'checkup'], choices: ['cover'], donate: ['next'] };

/** The New donor is the signed-in person themself: greet them by their Google first name ("Hello" with sign-in off). */
function greeting(donor: { name: string; newUser?: boolean }, user: AuthUser) {
  if (!donor.newUser) return `Hello, ${donor.name.split(' ')[0]}`;
  const first = !user.local && !user.guest && user.name ? user.name.split(' ')[0] : '';
  return first ? `Hello, ${first}` : 'Hello';
}

/**
 * Drop-first Home: Drop's open Cards and its chat in the main column, the numbers
 * as quiet tiles on the right, and the donation countdown always in the header.
 * A Donor with no donations yet (the New donor) sees plain empty tiles that point to their first donation.
 */
export default function Home({ donorId, go, version, refresh, clientId, accountKey, user }: PageProps & { user: AuthUser }) {
  const { data, error, loading } = useLoad(() => api.overview(donorId), [donorId, version]);
  const [dropTick, setDropTick] = useState(0);
  const drop = useLoad(() => api.drop(donorId), [donorId, version, dropTick]);
  const [introStep, setIntroStep] = useState<string | null>(() => introFocus(donorId));
  useEffect(() => {
    const bump = () => setDropTick((n) => n + 1);
    window.addEventListener('drop:changed', bump);
    return () => window.removeEventListener('drop:changed', bump);
  }, []);
  // Light up the tile Drop is talking about during the Intro
  useEffect(() => {
    const onFocus = (e: Event) => { const d = (e as CustomEvent<{ donorId: string; stepId: string | null }>).detail; if (d.donorId === donorId) setIntroStep(d.stepId); };
    window.addEventListener('intro:focus', onFocus);
    return () => window.removeEventListener('intro:focus', onFocus);
  }, [donorId]);
  useEffect(() => {
    document.body.classList.toggle('intro-point-account', introStep === 'data');
    return () => document.body.classList.remove('intro-point-account');
  }, [introStep]);
  const tile = (id: string) => `card${(INTRO_TILES[introStep || ''] || []).includes(id) ? ' intro-focus' : ''}`;

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorNote error={error || 'Could not load'} />;

  const { impact: im, health, cover, eligibility: el } = data;
  const firstTime = data.donations.completed + data.donations.deferred === 0;
  const scoreDelta = health.score != null && health.previousScore != null ? health.score - health.previousScore : 0;
  const daysTo = drop.data?.donate.daysTo;
  const from = drop.data?.donate.from;
  const checkup = drop.data?.bookings.find((b) => b.kind === 'care');

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <div className="page-title">{greeting(data.donor, user)}</div>
          <div className="page-sub row wrap" style={{ gap: 12 }}>
            <span>{firstTime ? 'No donations yet' : `${data.donor.bloodGroup} donor · ${data.donor.district}`}</span>
            <span className="countdown" aria-label="Next donation">
              <Icon name="drop" size={14} />
              {firstTime ? 'You can book your first donation'
                : daysTo === 0 ? 'You can donate now'
                  : daysTo != null ? <><span className="track"><span className="fill" style={{ width: `${Math.max(4, 100 - Math.round((daysTo / el.gapDays) * 100))}%` }} /></span>Donate in {daysTo} days</>
                    : 'Donation on hold for now'}
            </span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => (daysTo != null ? startBooking() : go('donate'))}>
          <Icon name="calendar" /> {firstTime ? 'Book my first donation' : daysTo != null ? 'Try donation booking' : 'Donation status'}
        </button>
      </div>

      <div className="drop-board">
        <div className="drop-main">
          <Copilot key={`${accountKey}|${donorId}`} accountKey={accountKey} donorId={donorId} go={go} clientId={clientId} inline firstTime={firstTime}
            top={<DropFeed donorId={donorId} version={version} refresh={refresh} calmLine={firstTime ? 'Your first donation will show here.' : `You have helped ${im.patientsHelped} patients so far.`} storiesInChat onDetails={() => go('checkups')} onDonate={() => go('donate')} />} />
        </div>

        <div className="drop-side">
          <button className={tile('helped')} style={{ textAlign: 'left' }} onClick={() => go('impact')}>
            <div className="row between"><span className="stat-label">Your blood has helped</span><Icon name="drop" className="faint" /></div>
            {firstTime ? <div className="bold mt-8">Your first donation will show here</div> : (
              <>
                <div className="row mt-8" style={{ alignItems: 'baseline' }}><span className="stat-value">{im.patientsHelped}</span><span className="muted">patients</span></div>
                <div className="small muted mt-8">{data.donations.completed} donations · {im.components} components{im.children ? ` · ${im.children} children` : ''}</div>
              </>
            )}
          </button>

          {!firstTime && data.badges && data.badges.length > 0 && (
            <BadgeHomePreview badges={data.badges} fresh={data.newBadges} onMore={() => go('impact')} />
          )}

          <button className={tile('score')} style={{ textAlign: 'left' }} onClick={() => go('health')}>
            <div className="row between"><span className="stat-label">Health score</span><Icon name="heart" className="faint" /></div>
            {health.score == null ? <div className="bold mt-8">After your first donation</div> : (
              <>
                <div className="row mt-8" style={{ alignItems: 'baseline' }}>
                  <span className="stat-value">{health.score}</span><span className="muted">/100</span>
                  {scoreDelta !== 0 && <span className={`pill ${scoreDelta > 0 ? 'pill-good' : 'pill-warn'}`}>{scoreDelta > 0 ? '▲' : '▼'} {Math.abs(scoreDelta)}</span>}
                </div>
                <div className="row wrap mt-8" style={{ gap: 6 }}>
                  {health.findings.length === 0 && <span className="pill pill-good">All results in range</span>}
                  {health.findings.slice(0, 2).map((f) => <span key={f.id} className={`pill ${severityPill[f.severity]}`}>{f.title}</span>)}
                </div>
              </>
            )}
          </button>

          <button className={tile('checkup')} style={{ textAlign: 'left' }} onClick={() => (checkup ? go('checkups') : bookCheckup())}>
            <div className="row between"><span className="stat-label">Doctor check-up</span><Icon name="doctor" className="faint" /></div>
            {checkup ? (
              <>
                <div className="bold mt-8">{fmtVisitDay(checkup.date)} · {checkup.time}</div>
                <div className="small muted mt-8">{checkup.doctor ? `${checkup.doctor} · ` : ''}{checkup.clinic || checkup.place}</div>
                {checkup.address && <div className="tiny faint mt-8">{checkup.address}</div>}
              </>
            ) : (
              <>
                <div className="bold mt-8">No visit booked</div>
                <div className="small muted mt-8">Tap to book a check-up slot.</div>
              </>
            )}
          </button>

          <button className={tile('cover')} style={{ textAlign: 'left' }} onClick={() => go('cover')}>
            <div className="row between"><span className="stat-label">Health cover</span><Icon name="shield" className="faint" /></div>
            {!cover ? <div className="bold mt-8">No cover linked yet</div> : (
              <>
                <div className="row mt-8" style={{ alignItems: 'baseline' }}>
                  <span className="stat-value">{rupees(cover.current)}</span>
                  {cover.current > cover.base && <span className="pill pill-good">+{rupees(cover.current - cover.base)}</span>}
                </div>
                <div className="small muted mt-8">
                  {cover.pointsToNext != null && cover.next ? `${cover.pointsToNext} score point${cover.pointsToNext === 1 ? '' : 's'} to ${rupees(cover.next)}; premium unchanged` : cover.next ? 'Keep monitoring for next step' : 'Top cover step reached'} · no insurer sharing
                </div>
              </>
            )}
          </button>

          <button className={tile('next')} style={{ textAlign: 'left' }} onClick={() => (daysTo != null ? startBooking() : go('donate'))}>
            <div className="row between"><span className="stat-label">Next donation</span><Icon name="calendar" className="faint" /></div>
            {firstTime ? <div className="bold mt-8">Book your first donation</div> : (
              <>
                <div className="stat-value mt-8" style={{ fontSize: 22 }}>{daysTo === 0 ? 'Today' : from ? fmtDate(from) : 'On hold'}</div>
                <div className="small muted mt-8">{daysTo == null && el.blockers.length ? `Paused: ${el.blockers[0].toLowerCase()}` : `Gap of ${el.gapDays} days after each donation`}</div>
              </>
            )}
          </button>

          {data.communities.length > 0 && (
            <div className="card">
              <div className="card-title"><Icon name="users" size={17} /> Your circles</div>
              <div className="stack mt-12" style={{ gap: 10 }}>
                {data.communities.map((c) => (
                  <button key={c.id} className="circle-row" onClick={() => go('community')}>
                    <span><b>{c.name}</b><span className="tiny muted">{c.kind} · {c.memberCount} members{c.notCounted ? ` · ${c.notCounted} not counted` : ''}</span></span>
                    <span className="small">{c.totals.patientsHelped} helped</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
