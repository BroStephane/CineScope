export type NavIconKey = 'home' | 'search' | 'compass' | 'trophy' | 'user' | 'calendar';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
  // On the mobile bottom nav, 'primary' items get their own slot; 'secondary'
  // items are tucked into the hamburger menu to keep the bar from feeling
  // cramped. The desktop header shows every item directly regardless.
  mobilePriority: 'primary' | 'secondary';
}

export const navItems: NavItem[] = [
  { href: '/', label: 'Accueil', icon: 'home', mobilePriority: 'primary' },
  { href: '/search', label: 'Recherche', icon: 'search', mobilePriority: 'primary' },
  { href: '/sorties', label: 'Sorties', icon: 'calendar', mobilePriority: 'secondary' },
  { href: '/decouverte', label: 'Découverte', icon: 'compass', mobilePriority: 'primary' },
  { href: '/tops', label: 'Tops', icon: 'trophy', mobilePriority: 'secondary' },
  { href: '/profile', label: 'Profil', icon: 'user', mobilePriority: 'primary' },
];
