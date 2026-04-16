interface Props {
  total: number;
  open: number;
  resolved: number;
}

export default function StatsBar({ total, open, resolved }: Props) {
  return (
    <section className="stats-bar" aria-label="Incident stats">
      <article className="stat-card">
        <div>Total incidents</div>
        <strong>{total}</strong>
      </article>
      <article className="stat-card">
        <div>Open incidents</div>
        <strong>{open}</strong>
      </article>
      <article className="stat-card">
        <div>Resolved incidents</div>
        <strong>{resolved}</strong>
      </article>
    </section>
  );
}
