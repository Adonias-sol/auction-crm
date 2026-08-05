import { periodLabels } from "../data";

export default function PeriodDropdown({ value, onChange }) {
  return (
    <select className="period-dropdown" value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.keys(periodLabels).map((k) => (
        <option key={k} value={k}>{periodLabels[k]}</option>
      ))}
    </select>
  );
}