/**
 * Circles (family, friends, workplace): shared impact without exposing
 * anyone's health. Members only ever see aggregates; individual names appear
 * on leaderboards only for members who opted in, and health data never does.
 * A member whose "count me in totals" Choice is off is left out of every total
 * (donations, patients helped, causes, blood groups, participation).
 */

const store = require('../data/store');
const impact = require('./impact');

function memberStats(donorId) {
  const journeys = impact.donorJourneys(donorId);
  const donations = store.getDonations(donorId).filter((d) => d.status === 'completed');
  return {
    donations: donations.length,
    patientsHelped: impact.summarise(journeys).patientsHelped,
    lastDonation: donations.length ? donations[donations.length - 1].date : null,
  };
}

function summary(communityId, viewerId) {
  const c = store.getCommunity(communityId);
  if (!c) return null;
  const members = c.memberIds.map((id) => ({ donor: store.getDonor(id), stats: memberStats(id) }));
  const contributors = members.filter((m) => m.donor.consent.includeInCommunityStats);
  const yearAgo = new Date(new Date(store.today()).getTime() - 365 * 864e5).toISOString().slice(0, 10);
  const totals = contributors.reduce((t, m) => ({
    donations: t.donations + m.stats.donations,
    patientsHelped: t.patientsHelped + m.stats.patientsHelped,
    activeThisYear: t.activeThisYear + (m.stats.lastDonation && m.stats.lastDonation >= yearAgo ? 1 : 0),
  }), { donations: 0, patientsHelped: 0, activeThisYear: 0 });

  const contexts = {};
  for (const m of contributors) {
    for (const j of impact.donorJourneys(m.donor.id)) {
      if (j.recipient) contexts[j.recipient.context] = (contexts[j.recipient.context] || 0) + 1;
    }
  }

  // Others see a member only when both their switches allow it. The viewer still sees themself with
  // their leaderboard switch off (marked "only you"), but not once they have left the totals.
  const listed = (m) => m.donor.consent.includeInCommunityStats && m.donor.consent.showOnLeaderboard;
  const shown = (m) => listed(m) || (m.donor.id === viewerId && m.donor.consent.includeInCommunityStats);
  const leaderboard = members
    .filter(shown)
    .sort((a, b) => b.stats.patientsHelped - a.stats.patientsHelped)
    .slice(0, 10)
    .map((m) => ({
      name: m.donor.id === viewerId ? `${m.donor.name} (you)` : m.donor.name.split(' ')[0],
      isYou: m.donor.id === viewerId,
      onlyYou: m.donor.id === viewerId && !listed(m),
      ...m.stats,
    }));

  const groups = {};
  for (const m of contributors) groups[m.donor.bloodGroup] = (groups[m.donor.bloodGroup] || 0) + 1;

  return {
    id: c.id, name: c.name, kind: c.kind, description: c.description,
    memberCount: members.length,
    notCounted: members.length - contributors.length,
    totals,
    participation: contributors.length ? Math.round((totals.activeThisYear / contributors.length) * 100) : 0,
    contexts: Object.entries(contexts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([context, count]) => ({ context, count })),
    bloodGroups: Object.entries(groups).map(([group, count]) => ({ group, count })),
    leaderboard,
    hiddenMembers: members.filter((m) => !shown(m)).length,
    privacyNote: 'Only consenting members contribute to shared totals, treatment categories, blood groups and participation. Health results are never shared; names appear only for members who also opted in to the leaderboard.',
  };
}

function forDonor(donorId) {
  const donor = store.getDonor(donorId);
  return donor.communityIds.map((id) => summary(id, donorId));
}

module.exports = { summary, forDonor };
