import {
  LayoutDashboard,
  Pill,
  Clock3,
  Package,
  CalendarClock,
  ClipboardList,
  Users,
  BarChart3,
  Bell,
  Settings,
} from 'lucide-react';

export const PRIMARY_NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/doses', label: "Today's doses", icon: Clock3 },
  { to: '/app/medicines', label: 'Medicines', icon: Pill },
  { to: '/app/stock', label: 'Stock & refills', icon: Package },
  { to: '/app/expiry', label: 'Expiry', icon: CalendarClock },
  { to: '/app/care-plans', label: 'Care plans', icon: ClipboardList },
  { to: '/app/family', label: 'Family hub', icon: Users },
  { to: '/app/reports', label: 'Reports', icon: BarChart3 },
  { to: '/app/notifications', label: 'Notifications', icon: Bell },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export default PRIMARY_NAV;
