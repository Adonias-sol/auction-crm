import { statusLabels } from "../data";

export default function Stamp({ status }) {
  return <span className={`stamp ${status}`}>{statusLabels[status]}</span>;
}