import { AppFooter, Callout, Text } from '@battleplans/ui';
import AppNavbar from '../components/AppNavbar';

declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;

/**
 * HomePage.tsx — BattlePack's home screen.
 *
 * Placeholder. The real screen lists the organiser's packs and offers the
 * create-pack step (name + game, which is fixed at creation). That arrives with
 * the schema and the category registry; until then this exists so the app has a
 * routable, signed-in screen and the access gate can be verified end to end.
 */
export default function HomePage() {
  return (
    <div className="flex flex-col min-h-dvh bg-gray-950">
      <AppNavbar />

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md flex flex-col gap-4">
          <Text variant="h2">BattlePack</Text>
          <Text variant="paragraph" color="secondary">
            Organise wargaming events — one pack describing what an event is,
            when it runs, how the rounds work and how to register.
          </Text>
          <Callout flavour="warning">
            Nothing to organise yet. Pack creation and the editor land with the
            next phase of the build.
          </Callout>
        </div>
      </main>

      <AppFooter className="shrink-0" appName="BattlePack" version={__APP_VERSION__} buildDate={__APP_BUILD_DATE__} />
    </div>
  );
}
