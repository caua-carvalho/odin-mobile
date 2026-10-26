# ODIN V2 Mobile

Expo + React Native + TypeScript mobile app for ODIN V2.

## Quick Start

```bash
cd apps/mobile
cp .env.example .env
# Edit .env with your backend API URL

# Install dependencies
npm install

# Start development server
npm start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Backend API URL | `http://127.0.0.1:8000/api` |

**Important:** For testing on a physical device, use your machine's LAN IP (e.g., `http://192.168.1.50:8000/api`). The backend must bind to `0.0.0.0:8000` for LAN access.

### Common URLs by Platform

| Platform | URL |
|----------|-----|
| iOS Simulator | `http://127.0.0.1:8000/api` |
| Android Emulator | `http://10.0.2.2:8000/api` |
| Physical Device (LAN) | `http://<your-lan-ip>:8000/api` |
| Web (Expo) | `http://127.0.0.1:8000/api` |

## Project Structure

```
apps/mobile/
├── app/
│   ├── _layout.tsx          # Root layout with AuthProvider
│   ├── login.tsx            # Login screen
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Tab navigator
│   │   ├── index.tsx        # Chat screen
│   │   ├── knowledge.tsx    # Knowledge library
│   │   ├── activity.tsx     # Runs & approvals
│   │   └── system.tsx       # System status
├── contexts/
│   └── AuthContext.tsx      # Authentication state
├── lib/
│   ├── api.ts               # API client (axios + SecureStore)
│   └── utils.ts             # Utility functions
├── global.css               # NativeWind/Tailwind styles
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## Key Features

- **Authentication**: JWT with refresh tokens stored in SecureStore
- **Chat**: Real-time WebSocket streaming, live tools, inline approvals, queued messages
- **Knowledge Library**: CRUD for notes, links, snippets, personal info
- **Activity**: View agent runs, approve/deny operations
- **System**: Monitor backend, database, Hermes health

## Dependencies

- Expo 51
- React Native 0.74
- Expo Router 3
- NativeWind 4 (Tailwind CSS)
- Axios for API calls
- Expo SecureStore for token storage

## Development Notes

- The app uses `expo-router` for file-based routing
- `(tabs)` is a route group for the main tab navigation
- Authentication state is managed via React Context
- API client handles automatic token refresh
- Styles use NativeWind (Tailwind CSS for React Native)

## Building

```bash
# Development build
expo install expo-dev-client
npx expo run:android
npx expo run:ios

# Production build (EAS)
eas build --platform android
eas build --platform ios
```