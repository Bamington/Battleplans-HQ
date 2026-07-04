import { Navbar } from '@battleplans/ui';
import type { AppEntry } from '@battleplans/ui';

const APPS: AppEntry[] = [
  {
    name: 'BattleCards',
    href: 'https://www.battlecards.app',
    description: 'Build and manage unit cards',
  },
  {
    name: 'BattlePack',
    href: '#',
    description: 'Organise wargaming events',
  },
  {
    name: 'BattlePlan',
    href: '/',
    description: 'Find stores and book tables',
    active: true,
  },
  {
    name: 'BattleBox',
    href: '#',
    description: 'Track your miniature collection',
  },
];

export { APPS };

type NavbarProps = Parameters<typeof Navbar>[0];

export default function AppNavbar(props: Omit<NavbarProps, 'apps'>) {
  return <Navbar {...props} apps={APPS} />;
}
