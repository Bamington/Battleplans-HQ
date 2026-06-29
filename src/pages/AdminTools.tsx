import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Button from '../components/Button';
import AltArrowLeft from '../icons/AltArrowLeft';
import AltArrowRight from '../icons/AltArrowRight';
import Shield from '../icons/Shield';

interface AdminLinkProps {
  title: string;
  description: string;
  href: string;
}

function AdminLink({ title, description, href }: AdminLinkProps) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className="w-full flex items-center justify-between gap-4 px-5 py-4
                 bg-gray-900 border border-gray-700 rounded-xl text-left
                 hover:border-blue-700 hover:bg-blue-950/40
                 transition-colors group"
    >
      <div className="flex flex-col gap-0.5">
        <span className="font-heading text-base text-white">{title}</span>
        <span className="font-body text-sm text-gray-400">{description}</span>
      </div>
      <AltArrowRight className="size-5 text-gray-500 group-hover:text-blue-400 shrink-0 transition-colors" />
    </button>
  );
}

export default function AdminTools() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">

      <Navbar fixed={false} />

      <div className="flex-1 flex flex-col items-center p-8 pt-12">
        <div className="w-full max-w-lg flex flex-col gap-6">

          {/* Header */}
          <div className="flex flex-col items-center gap-3 text-center">
            <Shield className="size-10 text-blue-400" />
            <h1 className="font-heading text-2xl text-white">Admin Tools</h1>
            <p className="font-body text-sm text-gray-400">
              Manage games, packs, and other app-wide settings.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-3 mt-2">
            <AdminLink
              title="Manage Users"
              description="View all users and manage their roles."
              href="/app/admin/users"
            />
            <AdminLink
              title="Manage Games"
              description="Control which games are visible and to whom."
              href="/app/admin/games"
            />
            <AdminLink
              title="Manage Packs"
              description="Review and manage published content packs."
              href="/app/admin/packs"
            />
          </div>

          {/* Back */}
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
