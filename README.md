# Real Time Rivals

Real Time Rivals is a fast 1v1 browser fighting game built with React, Vite, Tailwind CSS, Canvas, and WebRTC. Players can host a private room, join with a 6-character code, battle a local computer opponent, or walk through an in-game tutorial before jumping into a match.

The project is frontend-first and keeps the gameplay loop intentionally simple: move, punch, build charge, and unleash a beam attack. Online matches use peer-to-peer data sync for gameplay events and optional voice chat for live communication between players.

## Highlights

- Private online rooms with short shareable room codes
- Peer-to-peer match sync over WebRTC data channels
- Voice chat in online matches using WebRTC media streams
- Local computer opponent with `easy`, `medium`, and `hard` difficulty
- In-game tutorial for first-time players
- Rematch flow with accept/reject handling
- Canvas-rendered arena, HUD, health bars, and charge meter

## Tech Stack

- React 19
- Vite 8
- Tailwind CSS 4
- HTML5 Canvas for rendering
- WebRTC for multiplayer data and voice
- WebSocket signaling server for room setup

## Gameplay

Each fighter starts with 100 health.

- Basic attack deals light damage at close range
- Every successful basic hit builds charge
- After enough successful hits, the beam attack becomes available
- The beam attack has longer range and higher damage
- A round ends when one player reaches 0 health, or both do at the same time

### Controls

- `Arrow Left` / `Arrow Right`: Move
- `Space`: Basic attack
- `Q`: Beam attack when charged

### Modes

- `Online Match`: Create or join a room using a 6-character code
- `Computer Battle`: Play locally against the built-in AI
- `Tutorial`: Start a guided practice run with the tutorial panel open

## Project Structure

```text
src/
  components/
    GameCanvas.jsx     # Main arena UI, HUD, rematch flow, tutorial, mobile controls
    HealthBar.jsx      # Health bar display
    Lobby.jsx          # Home screen, room creation/joining, mode selection
  game/
    collision.js       # Hit detection and damage rules
    physics.js         # Shared game physics helpers
    player.js          # Player constants, movement, attacks, charge logic
  hooks/
    useControls.js     # Keyboard input handling
    useGameState.js    # Match state, host authority, AI opponent behavior
    useWebRTC.js       # WebRTC signaling, data channel, microphone, voice chat
  webrtc/
    peer.js            # WebRTC-related helper area
  App.jsx              # Lobby/game session switch
  main.jsx             # App bootstrap
  index.css            # Tailwind import and base styles
```

## Getting Started

### Prerequisites

- Node.js 18+ recommended
- npm
- A modern browser with WebRTC support

### Install

```bash
npm install
```

### Environment Variables

Create a local env file from the example:

```bash
cp .env.example .env
```

Available variables:

- `VITE_SIGNALING_URL`: WebSocket or HTTP(S) base URL for the signaling backend. The app normalizes it to the correct `ws:` or `wss:` protocol and appends the room query params automatically.

Example:

```env
VITE_SIGNALING_URL=wss://realtimerivals-backend.onrender.com/ws
```

### Start The Dev Server

```bash
npm run dev
```

Vite will print a local development URL, usually `http://localhost:5173`.

### Build For Production

```bash
npm run build
```

### Preview The Production Build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## Multiplayer Architecture

Online play uses two layers:

1. A WebSocket signaling server helps two players find each other, exchange SDP offers/answers, and share ICE candidates.
2. Once connected, WebRTC handles the actual peer-to-peer communication:
   - a data channel carries player inputs, state sync, tutorial status, profile info, and rematch messages
   - an audio track enables voice chat between players

The signaling endpoint is configured through the Vite environment:

```text
VITE_SIGNALING_URL
```

By default, the included `.env` and `.env.example` point to:

```text
wss://realtimerivals-backend.onrender.com/ws
```

The frontend reads this value in `src/hooks/useWebRTC.js`.

Room joins are parameterized with:

- `room`: the 6-character room code
- `action`: `create`, `join`, or `computer`

## Host Authority Model

The host acts as the authoritative game state owner for online matches.

- The joining player sends input events to the host
- The host resolves combat, health changes, and outcomes
- The host sends mirrored state back to the guest
- The guest renders the mirrored state from the opposite side of the arena

This keeps match resolution consistent and avoids both peers trying to author the same result.

## Voice Chat Notes

Voice chat is only enabled in online matches.

- The app requests microphone access when an online session starts
- HTTPS is required on most browsers for microphone access
- If permissions are denied or no microphone is available, gameplay still works
- Audio can be muted/unmuted in the match HUD

The app includes public STUN/TURN server configuration in `src/hooks/useWebRTC.js` to improve connectivity across networks.

## Configuration Notes

If you use a different tunnel, domain, or local network setup, update `server.allowedHosts`.

### Persistent Player Name

The lobby stores the player's name in browser storage:

- `localStorage` keeps the last used name across visits
- `sessionStorage` keeps the current session name for the active tab

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create the production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint across the project |

## Current Limitations

- There is no automated test suite yet
- Match sync is intentionally lightweight and not server-authoritative
- Voice chat depends on browser permissions and network support

## Future Improvements

- Add automated tests for game rules and React flows
- Add touch-first polish for mobile matchmaking and HUD interactions
- Improve rollback/reconciliation for multiplayer edge cases
- Add matchmaking, cosmetics, rounds, and richer combat mechanics

## Development Notes

This project uses a single-canvas arena with React managing the surrounding UI and session flow. Core gameplay rules live in reusable hook and utility modules, which makes it a good base for expanding into a larger real-time multiplayer game without rewriting the entire frontend architecture.
