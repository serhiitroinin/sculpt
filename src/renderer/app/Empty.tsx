const STARTERS = [
  "A wall hook for a 30 mm rail, 4 mm thick, with two countersunk screw holes",
  "A phone stand at 60°",
  "An enclosure for a 70 × 50 mm PCB with four M3 bosses",
];

export function Empty({ onPick }: { onPick(text: string): void }): React.JSX.Element {
  return (
    <div className="empty">
      <p className="empty-title">Describe a part. Drop a photo. Point at what to change.</p>
      <ul>
        {STARTERS.map((text) => (
          <li key={text}>
            <button onClick={() => onPick(text)}>
              <span>{text}</span>
              <kbd>⏎</kbd>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
