"use client";

import type { Player } from "@/app/lib/game-data";

export type LobbySnapshot = {
  code: string;
  hostId: string;
  selfId: string;
  players: Player[];
  countdown: number;
  mode: string;
  privacy: "Privat" | "Öffentlich";
  status: "setup" | "countdown" | "running" | "ended";
};

export type LobbyError = {
  message: string;
};

export type PlayerPosition = {
  accuracy?: number;
  latitude: number;
  longitude: number;
};

export async function connectRealtimeLobby({
  onConnectionChange,
  onError,
  onSnapshot
}: {
  onConnectionChange: (connected: boolean) => void;
  onError: (error: LobbyError) => void;
  onSnapshot: (snapshot: LobbySnapshot) => void;
}) {
  const { io } = await import("socket.io-client");
  const socket = io({
    transports: ["websocket", "polling"],
    autoConnect: true
  });

  socket.on("connect", () => onConnectionChange(true));
  socket.on("disconnect", () => onConnectionChange(false));
  socket.on("lobby:snapshot", onSnapshot);
  socket.on("lobby:error", onError);

  const connected = await new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => resolve(false), 5000);

    socket.once("connect", () => {
      window.clearTimeout(timer);
      resolve(true);
    });
  });

  if (!connected) {
    socket.disconnect();
    return null;
  }

  return {
    createLobby: (payload: {
      mode: string;
      name: string;
      position?: PlayerPosition | null;
      privacy: "Privat" | "Öffentlich";
    }) => socket.emit("lobby:create", payload),
    joinLobby: (payload: {
      code: string;
      name: string;
      position?: PlayerPosition | null;
    }) => socket.emit("lobby:join", payload),
    leaveLobby: () => socket.emit("lobby:leave"),
    emitReady: (ready: boolean) => socket.emit("player:ready", { ready }),
    emitPing: (position: PlayerPosition) => socket.emit("player:position", position),
    randomizeRoles: () => socket.emit("lobby:roles:randomize"),
    setMode: (mode: string) => socket.emit("lobby:mode", { mode }),
    startMatch: () => socket.emit("match:start"),
    disconnect: () => socket.disconnect()
  };
}
