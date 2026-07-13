export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export const navItems: NavItem[] = [
  { href: '/', label: 'Accueil', icon: '🏠' },
  { href: '/search', label: 'Recherche', icon: '🔍' },
  { href: '/profile', label: 'Profil', icon: '👤' },
];
