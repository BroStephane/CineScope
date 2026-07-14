export type NavIconKey = 'home' | 'search' | 'compass' | 'trophy' | 'user' | 'calendar';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
}

export const navItems: NavItem[] = [
  { href: '/', label: 'Accueil', icon: 'home' },
  { href: '/search', label: 'Recherche', icon: 'search' },
  { href: '/sorties', label: 'Sorties', icon: 'calendar' },
  { href: '/decouverte', label: 'Découverte', icon: 'compass' },
  { href: '/tops', label: 'Tops', icon: 'trophy' },
  { href: '/profile', label: 'Profil', icon: 'user' },
];
