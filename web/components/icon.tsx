import type { CSSProperties } from "react";
const paths = {
  jobs: ["M8 6V4h8v2", "M3 7h18v13H3z", "M3 12c5 3 13 3 18 0", "M10 12v3h4v-3"],
  review: ["M6 3h9l4 4v14H6z", "M14 3v5h5", "M9 12h7", "M9 16h5"],
  search: ["m16 16 5 5", "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0"],
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  check: ["m5 12 4 4L19 6"],
  globe: [
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    "M3 12h18",
    "M12 3c5 5 5 13 0 18-5-5-5-13 0-18",
  ],
  help: [
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    "M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5",
    "M12 17h.01",
  ],
  refresh: ["M20 7V3l-4 4", "M20 7a8 8 0 1 0 1 8", "M20 7h-5"],
  shield: ["M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z", "m8 12 3 3 5-6"],
  close: ["m6 6 12 12", "M6 18 18 6"],
  team: [
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    "M2 21v-3a7 7 0 0 1 14 0v3",
    "M18 4a4 4 0 0 1 0 8",
    "M19 15c2 0 3 2 3 4v2",
  ],
  clock: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0", "M12 6v6l4 2"],
  external: ["M14 3h7v7", "m10 14 11-11", "M10 3H3v18h18v-7"],
  logout: ["M9 3H3v18h6", "M9 12h12", "m16 7 5 5-5 5"],
};
export default function Icon({
  name,
  size = 20,
  className,
  style,
}: {
  name: keyof typeof paths;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {paths[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
