import { api } from '../api';
import type { PageProps } from '../App';
import { ErrorNote, Icon, Loading, Section, useLoad } from '../ui';

export default function Ecosystem({ version }: PageProps) {
  const { data, error, loading } = useLoad(() => api.network(), [version]);
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorNote error={error || 'Could not load'} />;
  const maxCtx = Math.max(...data.byContext.map((c) => c.count), 1);
  const maxHosp = Math.max(...data.byHospitalKind.map((c) => c.count), 1);

  return (
    <div className="stack fade-in">
      <div className="page-head">
        <div>
          <div className="page-title">The ecosystem view</div>
          <div className="page-sub">What every donor's contribution adds up to for blood centres, hospitals, labs, government and insurers. Aggregates only.</div>
        </div>
        <span className="pill pill-neutral">As of {data.asOf} · synthetic network</span>
      </div>

      <div className="grid grid-4">
        <Kpi v={data.donors} l="donors" />
        <Kpi v={data.donations} l="donations" />
        <Kpi v={data.patientsHelped.toLocaleString()} l="patients treated" />
        <Kpi v={`${data.repeatDonorRate}%`} l="repeat donors" />
      </div>

      <div className="grid grid-2">
        <Section title={<><Icon name="drop" size={17} /> Blood centres</>} sub="Supply and wastage">
          <div className="grid grid-2" style={{ gap: 10 }}>
            <Mini v={data.components.toLocaleString()} l="components produced" />
            <Mini v={`${data.wastage}%`} l="units expired unused" />
            {data.byKind.map((k) => <Mini key={k.kind} v={k.count} l={k.name} />)}
          </div>
          <p className="tiny muted mt-12">Donors who can see their impact come back: repeat donors are the safest supply and cut emergency replacement-donor drives.</p>
        </Section>

        <Section title={<><Icon name="hospital" size={17} /> Hospitals</>} sub="Units transfused by hospital type">
          <div className="stack" style={{ gap: 8 }}>
            {data.byHospitalKind.map((h) => (
              <div key={h.kind} className="bar-row"><span className="small">{h.kind}</span><div className="bar"><span style={{ width: `${(h.count / maxHosp) * 100}%` }} /></div><span className="small bold">{h.count}</span></div>
            ))}
          </div>
        </Section>

        <Section title={<><Icon name="landmark" size={17} /> Government & public health</>} sub="Anonymised screening signal from donation samples">
          <div className="grid grid-2" style={{ gap: 10 }}>
            <Mini v={`${data.screening.elevatedBp}%`} l="donors with raised BP" />
            <Mini v={`${data.screening.prediabetes}%`} l="in prediabetes/diabetes range" />
            <Mini v={`${data.screening.lowHb}%`} l="low haemoglobin" />
            <Mini v={data.labTests.toLocaleString()} l="lab tests run" />
          </div>
          <p className="tiny muted mt-12">Healthy-looking adults with no other contact with the health system — an early-warning feed for non-communicable-disease programmes.</p>
        </Section>

        <Section title={<><Icon name="shield" size={17} /> Insurers & employers</>} sub="Health-linked cover">
          <div className="grid grid-2" style={{ gap: 10 }}>
            <Mini v={`${data.screening.donorsWithCoverIncrease}%`} l="donors earned higher cover" />
            <Mini v="Same" l="premium" />
          </div>
          <p className="tiny muted mt-12">Insurers get verified, regularly monitored, lower-risk members; employers get a wellness benefit that also strengthens the local blood supply.</p>
        </Section>
      </div>

      <Section title="What the network's blood treated" sub="All transfused units, by clinical use">
        <div className="stack" style={{ gap: 8 }}>
          {data.byContext.map((c) => (
            <div key={c.context} className="bar-row"><span className="small">{c.context}</span><div className="bar"><span style={{ width: `${(c.count / maxCtx) * 100}%` }} /></div><span className="small bold">{c.count}</span></div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Kpi({ v, l }: { v: string | number; l: string }) {
  return <div className="card"><div className="stat-value">{v}</div><div className="stat-label">{l}</div></div>;
}

function Mini({ v, l }: { v: string | number; l: string }) {
  return <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 12 }}><div className="bold" style={{ fontSize: 20 }}>{v}</div><div className="tiny muted">{l}</div></div>;
}
