# SYNC ESCAPE

A cooperative real-time multiplayer game for 2–8 people, playable on phones and laptops. No accounts, no installation for players.

## How to play

1. One person chooses a nickname and **Create a room**.
2. Share the invite link or six-character room code. Others open the same site, enter a nickname, and join.
3. Start with at least two players.
4. **Signal Array:** Each player activates a separate signal. Two to four signals are required, depending on team size.
5. **Cipher Vault:** Each player gets a private piece of a four-digit code. Talk to each other and enter the complete code.
6. **Final Lock:** Every player taps READY to win together.

## Run locally

Install Node.js 18 or newer. In this directory:

```sh
npm install
npm start
```

Open http://localhost:3000. Test multiplayer in two different browser tabs or on two devices on the same local network (using your computer's local IP address and port 3000; firewalls may require adjustment).

## Deploy publicly (Render)

1. Upload this folder to a **GitHub repository** (include `package.json`, `server.js`, and the `public` folder).
2. At https://dashboard.render.com/ click **New → Web Service**, connect the repository.
3. Set language to **Node**, build command `npm install`, start command `npm start`.
4. Choose an available plan and deploy. Render provides a public `https://...onrender.com` URL. The app automatically uses encrypted WebSockets (`wss://`) when hosted over HTTPS.
5. Test using two separate phones/browsers before submitting the public URL.

**Important:** Server rooms live in memory and will reset on restarts/redeploys; the game is intended for short sessions. Render free instances may sleep when idle; the first visit after sleep may take time to wake. Use a single running server instance. For a production-scale project, add persistent Redis-based room storage and a shared WebSocket pub/sub adapter.

## Technology

Vanilla HTML/CSS/JavaScript front end; Node.js HTTP server with `ws` WebSocket library for real-time synchronization. Every authoritative game action runs on the server. No login, cookies, or external game services.

## Test checklist

- [ ] Create room and join with another device.
- [ ] Verify player list updates on both screens.
- [ ] Press signal 1 on device A and signal 2 on device B; both screens should show both signals charged.
- [ ] Confirm each player sees separate cipher hints; combine and enter the sequence.
- [ ] Tap READY on both devices; verify victory appears on both.
- [ ] Restart and verify the lobby is reset.

## Limitations

Rooms only allow new players before starting. A player who disconnects after the game begins can reconnect with the same browser via its saved resume token. The game is a starter project; improve disconnection handling, moderation, accessibility, security and automated test coverage before treating it as production software.
