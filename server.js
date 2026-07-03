const { createServer } = require("node:http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const lobbies = new Map();
const gameModes = new Set([
  "Klassisch",
  "Infektion",
  "Letzter Überlebender",
  "Teammodus",
  "Zeitjagd",
  "Ohne Karte",
  "Freizeitpark",
  "Studio-Herausforderung"
]);

function randomLobbyCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    const raw = Array.from({ length: 6 }, () =>
      alphabet[Math.floor(Math.random() * alphabet.length)]
    ).join("");
    code = `${raw.slice(0, 3)}-${raw.slice(3)}`;
  } while (lobbies.has(code));
  return code;
}

function normalizeLobbyCode(value) {
  const compact = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return compact.length === 6 ? `${compact.slice(0, 3)}-${compact.slice(3)}` : "";
}

function initials(name) {
  return (String(name || "Du").trim() || "Du").slice(0, 2).toUpperCase();
}

function makePlayer(socket, { name, role, isHost, position }) {
  const playerName = String(name || "Du").trim().slice(0, 18) || "Du";
  const latitude = Number(position?.latitude);
  const longitude = Number(position?.longitude);
  const hasPosition = Number.isFinite(latitude) && Number.isFinite(longitude);

  return {
    id: socket.id,
    name: playerName,
    handle: `@${playerName.toLowerCase().replace(/[^a-z0-9]+/gi, "") || "spieler"}`,
    role,
    team: isHost ? "Host" : "Nova",
    isHost,
    avatar: initials(playerName),
    color: isHost ? "#f4f8fb" : "#cad5df",
    x: hasPosition ? 50 : 48 + Math.random() * 8,
    y: hasPosition ? 50 : 52 + Math.random() * 8,
    latitude: hasPosition ? latitude : undefined,
    longitude: hasPosition ? longitude : undefined,
    accuracy: Number.isFinite(Number(position?.accuracy)) ? Number(position.accuracy) : undefined,
    ready: false,
    status: "live",
    battery: 100,
    signal: hasPosition ? 98 : 80,
    xp: 0,
    trail: [
      [45, 61],
      [47, 59],
      [48, 58]
    ],
    perks: isHost ? ["Host", "Radarscan"] : ["Live-Ping", "Spurtarnung"]
  };
}

function snapshot(lobby, selfId) {
  return {
    code: lobby.code,
    hostId: lobby.hostId,
    selfId,
    players: Array.from(lobby.players.values()),
    countdown: lobby.countdown,
    mode: lobby.mode,
    privacy: lobby.privacy,
    status: lobby.status
  };
}

function emitLobby(io, lobby) {
  for (const socketId of lobby.players.keys()) {
    io.to(socketId).emit("lobby:snapshot", snapshot(lobby, socketId));
  }
}

function getLobbyForSocket(socket) {
  const code = socket.data.lobbyCode;
  if (!code) return null;
  return lobbies.get(code) || null;
}

function leaveCurrentLobby(io, socket) {
  const lobby = getLobbyForSocket(socket);
  if (!lobby) return;

  socket.leave(lobby.code);
  lobby.players.delete(socket.id);

  if (lobby.players.size === 0) {
    lobbies.delete(lobby.code);
  } else {
    if (lobby.hostId === socket.id) {
      const nextHost = lobby.players.values().next().value;
      lobby.hostId = nextHost.id;
      lobby.players.set(nextHost.id, {
        ...nextHost,
        isHost: true,
        team: "Host",
        role: "Sucher",
        color: "#f4f8fb"
      });
    }
    emitLobby(io, lobby);
  }

  socket.data.lobbyCode = null;
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    socket.on("lobby:create", ({ name, privacy, mode, position }) => {
      leaveCurrentLobby(io, socket);
      const code = randomLobbyCode();
      const lobby = {
        code,
        countdown: 0,
        hostId: socket.id,
        mode: mode || "Freizeitpark",
        privacy: privacy === "Öffentlich" ? "Öffentlich" : "Privat",
        status: "setup",
        players: new Map()
      };

      lobby.players.set(
        socket.id,
        makePlayer(socket, {
          name,
          role: "Sucher",
          isHost: true,
          position
        })
      );
      lobbies.set(code, lobby);
      socket.data.lobbyCode = code;
      socket.join(code);
      emitLobby(io, lobby);
    });

    socket.on("lobby:join", ({ code, name, position }) => {
      const normalizedCode = normalizeLobbyCode(code);
      const lobby = lobbies.get(normalizedCode);
      if (!lobby) {
        socket.emit("lobby:error", {
          message: "Diese Lobby wurde nicht gefunden. Prüfe den Code."
        });
        return;
      }

      leaveCurrentLobby(io, socket);
      socket.data.lobbyCode = normalizedCode;
      socket.join(normalizedCode);
      lobby.players.set(
        socket.id,
        makePlayer(socket, {
          name,
          role: "Verstecker",
          isHost: false,
          position
        })
      );
      emitLobby(io, lobby);
    });

    socket.on("lobby:leave", () => {
      leaveCurrentLobby(io, socket);
      socket.emit("lobby:snapshot", {
        code: "",
        hostId: "",
        selfId: socket.id,
        players: [],
        countdown: 0,
        mode: "Freizeitpark",
        privacy: "Privat",
        status: "setup"
      });
    });

    socket.on("player:ready", ({ ready }) => {
      const lobby = getLobbyForSocket(socket);
      if (!lobby) return;
      const player = lobby.players.get(socket.id);
      if (!player) return;
      lobby.players.set(socket.id, { ...player, ready: Boolean(ready) });
      emitLobby(io, lobby);
    });

    socket.on("lobby:mode", ({ mode }) => {
      const lobby = getLobbyForSocket(socket);
      if (!lobby || lobby.hostId !== socket.id) {
        socket.emit("lobby:error", { message: "Nur der Host kann den Spielmodus ändern." });
        return;
      }
      if (lobby.status !== "setup" || !gameModes.has(mode)) {
        socket.emit("lobby:error", { message: "Dieser Spielmodus kann gerade nicht gewählt werden." });
        return;
      }

      lobby.mode = mode;
      for (const [playerId, player] of lobby.players) {
        lobby.players.set(playerId, { ...player, ready: false });
      }
      emitLobby(io, lobby);
    });

    socket.on("lobby:roles:randomize", () => {
      const lobby = getLobbyForSocket(socket);
      if (!lobby || lobby.hostId !== socket.id) {
        socket.emit("lobby:error", { message: "Nur der Host kann Rollen verteilen." });
        return;
      }
      const players = Array.from(lobby.players.values());
      const seekerIndex = Math.floor(Math.random() * players.length);
      players.forEach((player, index) => {
        lobby.players.set(player.id, {
          ...player,
          role: index === seekerIndex ? "Sucher" : "Verstecker",
          status: "live"
        });
      });
      emitLobby(io, lobby);
    });

    socket.on("match:start", () => {
      const lobby = getLobbyForSocket(socket);
      if (!lobby || lobby.hostId !== socket.id) {
        socket.emit("lobby:error", { message: "Nur der Host kann die Runde starten." });
        return;
      }
      const players = Array.from(lobby.players.values());
      if (players.length < 2) {
        socket.emit("lobby:error", {
          message: "Zum Starten werden mindestens 2 Spieler benötigt."
        });
        return;
      }
      if (players.some((player) => !player.ready)) {
        socket.emit("lobby:error", {
          message: "Alle Spieler müssen bereit sein."
        });
        return;
      }
      lobby.status = "countdown";
      lobby.countdown = 5;
      emitLobby(io, lobby);
    });

    socket.on("player:position", (position) => {
      const lobby = getLobbyForSocket(socket);
      if (!lobby) return;
      const player = lobby.players.get(socket.id);
      if (!player) return;

      const latitude = Number(position?.latitude);
      const longitude = Number(position?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      lobby.players.set(socket.id, {
        ...player,
        latitude,
        longitude,
        accuracy: Number.isFinite(Number(position?.accuracy)) ? Number(position.accuracy) : player.accuracy,
        signal: Math.max(40, Math.min(99, 110 - Number(position?.accuracy || 30))),
        trail: [...player.trail.slice(-2), [player.x, player.y]]
      });
      emitLobby(io, lobby);
    });

    socket.on("disconnect", () => {
      leaveCurrentLobby(io, socket);
    });
  });

  setInterval(() => {
    for (const lobby of lobbies.values()) {
      if (lobby.status !== "countdown") continue;
      lobby.countdown = Math.max(0, lobby.countdown - 1);
      if (lobby.countdown === 0) lobby.status = "running";
      emitLobby(io, lobby);
    }
  }, 1000);

  httpServer.listen(port, hostname, () => {
    console.log(`SEEKR-Echtzeitserver bereit unter http://${hostname}:${port}`);
  });
});
