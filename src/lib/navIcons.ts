import { Home, Search, Compass, Trophy, User } from 'lucide-react';
import type { NavIconKey } from './navItems';

export const navIcons: Record<NavIconKey, typeof Home> = {
  home: Home,
  search: Search,
  compass: Compass,
  trophy: Trophy,
  user: User,
};
