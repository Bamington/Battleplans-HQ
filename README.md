# BattleCards

A web-based application for creating custom unit cards for tabletop wargaming. Built with React + Vite, wrapped with Capacitor for iOS and Android deployment.

## Tech Stack

- **React + TypeScript** — UI and app logic
- **Vite** — Development server and build tool
- **Capacitor** — iOS and Android wrapper
- **Supabase** *(planned)* — Backend, database, and authentication
- **Google OAuth** *(planned)* — User login

## Getting Started

### Environment setup.

For the server, you will need the following dependencies:
```md
- NodeJS >= v22.0
```

For the environment, you will need A .env file with at a minimum the following defined:
```js
# Supabase configuration
# Get these values from your Supabase project settings: https://supabase.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anonymous-key-here

# Google OAuth (planned feature)
# Get these from Google Cloud Console: https://console.cloud.google.com
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here
```


### Running the server.
```bash
npm install       # Install dependencies
npm run dev       # Start local development server
npm run build     # Build for production
```

## Project Structure

```
src/
├── components/   # Reusable UI components
├── pages/        # App screens and views
├── store/        # Local data and state management
└── assets/       # Images, icons, and fonts
```
