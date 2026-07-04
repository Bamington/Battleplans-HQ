import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import type { AppEntry } from '../components/Navbar';
import Button from '../components/Button';
import AltArrowLeft from '../icons/AltArrowLeft';
import AltArrowRight from '../icons/AltArrowRight';
import Shield from '../icons/Shield';

export interface AdminToolLink {
  title: string;
  description: string;
  href: string;
}

export interface AdminToolsPageProps {
  logo?: React.ReactNode;
  apps?: AppEntry[];
  description?: string;
  links: AdminToolLink[];
}

function AdminLinkItem({ title, description, href }: AdminToolLink) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className="w-full flex items-center justify-between gap-4 px-5 py-4
                 bg-neutral-900 border border-neutral-700 rounded-xl text-left
                 hover:border-primary-700 hover:bg-primary-950/40
                 transition-colors group"
    >
      <div className="flex flex-col gap-0.5">
        <span className="font-heading text-base text-white">{title}</span>
        <span className="font-body text-sm text-neutral-400">{description}</span>
      </div>
      <AltArrowRight className="size-5 text-neutral-500 group-hover:text-primary-400 shrink-0 transition-colors" />
    </button>
  );
}

export default function AdminToolsPage({ logo, apps, description, links }: AdminToolsPageProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">

      <Navbar fixed={false} logo={logo} apps={apps} />

      <div className="flex-1 flex flex-col items-center p-8 pt-12">
        <div className="w-full max-w-lg flex flex-col gap-6">

          <div className="flex flex-col items-center gap-3 text-center">
            <Shield className="size-10 text-primary-400" />
            <h1 className="font-heading text-2xl text-white">Admin Tools</h1>
            {description && (
              <p className="font-body text-sm text-neutral-400">{description}</p>
            )}
          </div>

          <div className="flex flex-col gap-3 mt-2">
            {links.map(link => (
              <AdminLinkItem key={link.href} {...link} />
            ))}
          </div>

          <div className="flex justify-center mt-2">
            <Button
              variant="outline"
              color="secondary"
              leftIcon={<AltArrowLeft className="size-4" />}
              onClick={() => navigate('/app')}
            >
              Back to home
            </Button>
          </div>

        </div>
      </div>

    </div>
  );
}
