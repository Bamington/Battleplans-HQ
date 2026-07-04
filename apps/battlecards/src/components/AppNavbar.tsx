import { Navbar } from '@battleplans/ui';
import type { AppEntry } from '@battleplans/ui';

const APPS: AppEntry[] = [
  {
    name: 'BattleCards',
    href: '/',
    description: 'Build and manage unit cards',
    active: true,
  },
  {
    name: 'BattlePack',
    href: '#',
    description: 'Organise wargaming events',
  },
  {
    name: 'BattlePlan',
    href: 'https://battleplans-hq-battleplan-xi.vercel.app/app',
    description: 'Find stores and book tables',
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
