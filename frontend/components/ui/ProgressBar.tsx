interface Props {
  value: number;
  label?: string;
}

export default function ProgressBar({ value, label }: Props) {
  const safe = Math.max(0, Math.min(1, value));
  const now = Math.round(safe * 100);

  return (
    <div className="progress-wrap">
      {label && <div>{label}</div>}
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label ?? "progress"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={now}
      >
        <div className="progress-fill" style={{ width: `${safe * 100}%` }} />
      </div>
    </div>
  );
}
