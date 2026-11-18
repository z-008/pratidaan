/** Where a result sits in its bands (best on the right), with last donation's band outlined. */
import type { WbBand } from '../../api';

export default function BandBar({ row }: { row: WbBand }) {
  const n = row.bands.length;
  // Bands come best first; draw them worst on the left so "better" reads left to right
  const order = [...Array(n).keys()].reverse();
  return (
    <div className="wb-bandbar" aria-label={`${row.label}: ${row.band.label}${row.previous?.band ? `, was ${row.previous.band.label}` : ''}`}>
      <div className="segs">
        {order.map((i) => <span key={i} className={`seg b${i}${i === row.band.index ? ' on' : ''}${row.previous?.band && row.previous.band.index === i && i !== row.band.index ? ' was' : ''}`} />)}
      </div>
      <div className="lbl">{order.map((i) => <span key={i}>{row.bands[i]}</span>)}</div>
    </div>
  );
}
