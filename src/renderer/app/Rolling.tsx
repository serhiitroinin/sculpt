import { useEffect, useRef, useState } from "react";

/** A changed number rolls rather than snapping, the way an instrument reads. */
export function Rolling({ value, className }: { value: string; className?: string }): React.JSX.Element {
  const [shown, setShown] = useState(value);
  const [rolling, setRolling] = useState(false);
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setRolling(true);
    const timer = setTimeout(() => {
      setShown(value);
      setRolling(false);
    }, 90);
    return () => clearTimeout(timer);
  }, [value]);

  return <span className={`${className ?? ""} rolling${rolling ? " out" : ""}`}>{shown}</span>;
}
