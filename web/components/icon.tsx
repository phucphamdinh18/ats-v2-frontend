import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Clock3,
  ExternalLink,
  Globe2,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  UsersRound,
  X,
  RefreshCw,
  FileCheck2,
  Sparkles,
  Mail,
  Phone,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";

const icons = {
  jobs: BriefcaseBusiness,
  review: FileCheck2,
  search: Search,
  arrow: ArrowRight,
  check: Check,
  globe: Globe2,
  help: HelpCircle,
  refresh: RefreshCw,
  shield: ShieldCheck,
  close: X,
  team: UsersRound,
  clock: Clock3,
  external: ExternalLink,
  logout: LogOut,
  dashboard: LayoutDashboard,
  menu: Menu,
  collapse: PanelLeftClose,
  expand: PanelLeftOpen,
  sparkles: Sparkles,
  mail: Mail,
  phone: Phone,
  location: MapPin,
} satisfies Record<string, LucideIcon>;

export default function Icon({
  name,
  size = 20,
  className,
  style,
}: {
  name: keyof typeof icons;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const Glyph = icons[name];
  return <Glyph aria-hidden="true" width={size} height={size} strokeWidth={1.8} className={className} style={style} />;
}
