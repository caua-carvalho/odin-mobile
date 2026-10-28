# ODIN V2 Mobile

Companion client for ODIN V2 built with **Expo SDK 58**, React Native 0.88 and
TypeScript. It mirrors the web client's black/graphite HUD identity — holographic
orange, cyan telemetry, Inter + JetBrains Mono, animated thinking-orb core — while
staying focused on the actions that matter on a phone. The web app remains the
more complete client; see [`docs/mobile-parity.md`](../../docs/mobile-parity.md)
for the feature matrix.

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Expo SDK 58 (`expo ~58.0.19`), Expo Go compatible |
| UI | React Native 0.88, React 19.3, Expo Router 58 |
| Motion | Reanimated 4.7 + `react-native-worklets`, `react-native-svg` |
| Type | Inter, JetBrains Mono (`@expo-google-fonts/*`) |
| Storage | `expo-secure-store` for access/refresh tokens |
| Networking | Axios + WebSocket run stream |

There is no NativeWind/Tailwind dependency; the web palette and spacing scale
are expressed as native tokens in [`lib/theme.ts`](lib/theme.ts).

## Quick start

Requires Node.js 22.13+ LTS and the Expo Go app on your device.

```bash
cd apps/mobile
npm install

# Physical device: backend must listen on the LAN
#   cd ../../backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

npm start          # LAN mode, scan the QR code with Expo Go
npm run start:lan  # same, explicit
npm run android    # Android emulator
npm run ios        # iOS simulator (macOS)
```

The app is designed to run in **Expo Go**; no custom dev client is required.
Use `npx expo-doctor` and `npm run typecheck` before shipping changes.

## API host resolution

`EXPO_PUBLIC_API_URL` is optional. Resolution order in
[`lib/api.ts`](lib/api.ts):

1. An explicit non-loopback `EXPO_PUBLIC_API_URL`.
2. The Metro/Expo `hostUri` host with port `8000` when the env var is missing or
   points at `localhost`/`127.0.0.1` — this is what makes Expo Go on a physical
   device work without editing `.env`.
3. Platform fallback: `http://10.0.2.2:8000/api` on Android emulators,
   `http://127.0.0.1:8000/api` elsewhere.

Set the variable explicitly when the backend is behind a tunnel, uses another
port, or is served over HTTPS:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.50:8000/api
```

Every request sends `X-Odin-Client: mobile`. The backend uses this header to
return refresh tokens in the login/refresh JSON body instead of only the
HttpOnly cookie used by the web client. Tokens are kept in SecureStore and
refreshed transparently on `401`; a failed refresh signs the user out.

## Screens

| Route | Purpose |
|-------|---------|
| `app/login.tsx` | HUD login with the animated orb |
| `app/(tabs)/index.tsx` | **Nexus** — mobile command center: orb, quick dispatch, approvals, stats, recent sessions/runs, telemetry |
| `app/(tabs)/chat.tsx` | Streaming chat, tool calls, inline approvals, queued messages, session history, deep links (`?conversationId=`) |
| `app/(tabs)/knowledge.tsx` | Biblioteca — search/filter, create, edit and delete knowledge records |
| `app/(tabs)/activity.tsx` | Atividade — run history and approval inbox |
| `app/(tabs)/system.tsx` | Telemetria — node health, subsystem metrics, session and network info |

Navigation is a floating five-tab glass dock ([`components/hud/HudDock.tsx`](components/hud/HudDock.tsx))
rather than the stock tab bar.

## Project structure

```
apps/mobile/
├── app/
│   ├── _layout.tsx           # Fonts, auth/status providers, splash
│   ├── index.tsx             # Auth-aware redirect
│   ├── login.tsx
│   └── (tabs)/
│       ├── _layout.tsx       # Custom HudDock
│       ├── index.tsx         # Nexus
│       ├── chat.tsx
│       ├── knowledge.tsx
│       ├── activity.tsx
│       └── system.tsx
├── components/
│   ├── hud/                  # Backdrop, Screen, header, dock, primitives
│   └── orb/
│       ├── AgentOrb.tsx      # Port of the web AgentOrb (thinking-orbs)
│       └── thinking-orb.ts   # State/variant frame maths, runs as a worklet
├── contexts/                 # Auth + global ODIN status polling
├── hooks/useKeyboardVisible.ts
└── lib/
    ├── api.ts                # API client, tokens, LAN host, WebSocket helpers
    ├── fonts.ts
    ├── theme.ts              # Colors, spacing, radii, typography, orb states
    └── utils.ts
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Expo dev server (LAN) |
| `npm run start:lan` | Expo dev server, explicit LAN |
| `npm run android` / `ios` / `web` | Target-specific dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` |
| `npm run doctor` | `expo-doctor` |
| `npm run export:android` | Production Android JS bundle validation |
| `npm run build:apk` | EAS Build do APK instalável (perfil `preview`) |
| `npm run ota:preview -- -m "msg"` | Publica um update OTA no canal `preview` |

## APK instalável + atualizações OTA (EAS Update)

O app já está configurado com `expo-updates` e o projeto EAS
`@caua_carvalho/odin-mobile`. O APK é gerado **uma vez**; depois disso, mudanças
de JavaScript, telas, estilos e assets são publicadas pelo EAS Update e chegam
aos aparelhos sem novo build.

| Item | Valor |
|------|-------|
| Projeto EAS | `e7cc460f-1d95-4f4f-b969-a2d3fa4290af` |
| Perfil do APK | `preview` (`eas.json`) |
| Canal/branch OTA | `preview` |
| Runtime | `fingerprint` (garante compatibilidade nativa) |
| Política de check | `ON_LOAD` (baixa em background, aplica na próxima abertura) |

### 1. Gerar o APK (primeira vez ou mudança nativa)

```bash
cd apps/mobile

# autentique no Expo se necessário
npx eas-cli login

# build na nuvem; ao final o EAS imprime a URL do APK
npm run build:apk
```

O perfil `preview` gera um **APK** (`buildType: apk`) com distribuição interna.
A keystore é criada e guardada pelo EAS; não é preciso ter Android SDK local.
Baixe o APK pelo link do build e instale no aparelho (permita "instalar apps
desconhecidos" para o navegador/gerenciador de arquivos).

### 2. Publicar uma atualização (sem novo APK)

Depois de alterar o app:

```bash
cd apps/mobile
npm run ota:preview -- -m "feat: ajusta tela de chat"
```

Ou diretamente:

```bash
npx eas-cli update \
  --channel preview \
  --environment preview \
  --message "feat: ajusta tela de chat"
```

O `fingerprint.config.js` ignora scripts do `package.json`, `.gitignore`, `.easignore`
e `eas.json` no cálculo do runtime. Assim, editar esses arquivos não invalida os
APKs já instalados. Dependências nativas, config plugins, ícones e o resultado
do prebuild continuam mudando o fingerprint (e exigem novo APK).

Na próxima abertura o APK baixa o bundle novo em background e aplica. Para
forçar imediatamente, abra **Telemetria → Atualizações OTA → Verificar
atualização** dentro do app (o botão baixa e reinicia).

### O que vai por OTA e o que exige novo APK

| OTA (sem novo APK) | Novo APK obrigatório |
|--------------------|----------------------|
| Telas, componentes, textos, tema, animações | Adicionar/atualizar módulo nativo (`expo-*`, libs com código nativo) |
| Lógica, chamadas de API, endpoints | Mudar permissões, `package`, ícone/splash nativo |
| Imagens e fontes empacotadas no bundle | Atualizar Expo SDK, React Native ou o CNG (prebuild) |

O `runtimeVersion` usa `fingerprint`: um update só é entregue a builds com a
mesma impressão digital nativa. Se você adicionar uma dependência nativa, o
fingerprint muda — publique um APK novo e depois os próximos updates para ele.

### Configurar o servidor dentro do app

O APK não tem endereço de backend embutido. No primeiro uso a folha **Servidor
ODIN** abre automaticamente; informe, por exemplo:

```text
http://192.168.1.50:8000/api
```

O endereço fica no SecureStore e pode ser alterado depois em **Telemetria →
Rede e segurança → Endpoint API**, sem gerar outro APK. Para funcionar na LAN:

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

O manifest Android é gerado com `usesCleartextTraffic: true` (plugin
`expo-build-properties`) para permitir `http://` na rede local. Fora da LAN,
use um túnel/HTTPS e informe a URL pública.

### Rollback de um update

```bash
npx eas-cli update:list --branch preview
npx eas-cli update:rollback <GROUP_ID>
```

O rollback republica o update anterior; se não houver, volta ao bundle embutido
no APK.

## Notes and limits

- **Companion scope.** Chat, knowledge management, approvals and telemetry are
  available, but deep administration and dense analytics stay on web.
- **Cleartext HTTP.** O APK é gerado com `usesCleartextTraffic: true`, então
  aceita `http://` na LAN. Fora dela, use HTTPS (túnel/domínio).
- **Background work.** Polling pauses when the app is backgrounded by React
  Native; push notifications and offline sync are not implemented.
- **Streaming.** Runs stream over `/api/runs/{id}/ws`; the client reconnects,
  replays with `?after=<seq>` and falls back to REST polling if the socket drops.
