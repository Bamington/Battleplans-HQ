import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@battleplans/ui';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/app', { replace: true });
        return;
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          subscription.unsubscribe();
          navigate('/app', { replace: true });
        }
      });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950">
      <p className="font-body text-sm text-neutral-400">Signing you in…</p>
    </div>
  );
}
