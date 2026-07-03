"use client";

import { motion } from "framer-motion";
import {
  BatteryMedium,
  Crosshair,
  Eye,
  LucideIcon,
  MapPin,
  Radio,
  ScanLine,
  SignalHigh,
  Volume2,
  Wifi
} from "lucide-react";
import { attractions, zones, type Player } from "@/app/lib/game-data";
import { LiveMapLayer } from "@/app/components/LiveMapLayer";
import { cx } from "@/app/lib/utils";

type TacticalMapProps = {
  inLobby: boolean;
  livePosition: {
    accuracy: number;
    latitude: number;
    longitude: number;
  } | null;
  matchStatus: "setup" | "countdown" | "running" | "ended";
  mode: string;
  onCatchCheck: () => void;
  onPing: () => void;
  roster: Player[];
  revealSeconds: number;
  scanActive: boolean;
  onScan: () => void;
  reducedMotion: boolean;
};

const zoneClass = {
  safe: "border-white/20 bg-white/[0.055] text-white/70 shadow-[0_0_44px_rgba(239,247,255,0.055)]",
  danger:
    "border-white/15 bg-white/[0.038] text-white/60 shadow-[0_0_44px_rgba(216,246,255,0.045)]",
  restricted:
    "border-hazard/30 bg-hazard/[0.055] text-white/60 shadow-[0_0_44px_rgba(216,174,184,0.06)]"
};

const motionEase = [0.19, 1, 0.22, 1] as const;

export function TacticalMap({
  inLobby,
  livePosition,
  matchStatus,
  mode,
  onCatchCheck,
  onPing,
  roster,
  revealSeconds,
  scanActive,
  onScan,
  reducedMotion
}: TacticalMapProps) {
  const mapDisabled = mode === "Ohne Karte";
  const hasLiveMap = Boolean(
    !mapDisabled &&
      (livePosition ||
      roster.some(
        (player) =>
          typeof player.latitude === "number" && typeof player.longitude === "number"
      ))
  );

  return (
    <div className="glass-panel relative h-full min-h-0 overflow-hidden rounded-[22px] bg-[#090b0d] sm:rounded-[36px]">
      {mapDisabled ? (
        <div className="absolute inset-0 bg-[#090b0d]">
          <div className="absolute inset-0 bg-radar-grid [background-size:52px_52px] opacity-35" />
          <div
            className="absolute left-1/2 top-1/2 z-20 w-[min(86%,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-white/10 bg-black/70 p-5 text-center"
            data-testid="map-disabled"
          >
            <Eye className="mx-auto h-7 w-7 text-white/65" />
            <div className="mt-3 text-lg font-semibold text-white">Karte deaktiviert</div>
            <div className="mt-1 text-sm leading-snug text-white/55">
              In diesem Modus gibt es nur Richtungs-, Distanz- und Signalhinweise.
            </div>
          </div>
        </div>
      ) : hasLiveMap ? (
        <LiveMapLayer position={livePosition} roster={roster} />
      ) : (
        <>
          <div className="absolute inset-0 tactical-map-bg" />
          <div className="absolute inset-0 bg-radar-grid [background-size:52px_52px] opacity-55" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.12),transparent_34%)] opacity-70" />
          <MapRoutes reducedMotion={reducedMotion} />
        </>
      )}

      {!mapDisabled && !hasLiveMap && zones.map((zone) => (
        <motion.div
          key={zone.name}
          className={cx(
            "absolute rounded-[14px] border px-2 py-1.5 text-[0.5rem] font-semibold uppercase tracking-[0.12em] backdrop-blur-xl sm:rounded-[28px] sm:px-3 sm:py-2 sm:text-[0.62rem] sm:tracking-[0.16em]",
            zoneClass[zone.type as keyof typeof zoneClass]
          )}
          style={{
            left: `${zone.x}%`,
            top: `${zone.y}%`,
            width: `${zone.w}%`,
            height: `${zone.h}%`
          }}
          animate={
            reducedMotion
              ? undefined
              : { opacity: [0.48, 0.82, 0.48], scale: [1, 1.01, 1] }
          }
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <span>{zone.name}</span>
        </motion.div>
      ))}

      {!mapDisabled && !hasLiveMap ? <div className="absolute inset-0 fog-mask" /> : null}

      {!mapDisabled && !hasLiveMap && attractions.map((attraction, index) => {
        const Icon = attraction.icon;
        return (
          <motion.div
            key={attraction.name}
            className="glass-card absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full px-2 py-1 text-[0.58rem] font-semibold text-white/80 sm:gap-2 sm:px-2.5 sm:py-1.5 sm:text-[0.66rem]"
            style={{ left: `${attraction.x}%`, top: `${attraction.y}%` }}
            animate={reducedMotion ? undefined : { y: [0, index % 2 ? 2 : -2, 0] }}
            transition={{
              duration: 5.5 + index,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Icon className="relative z-10 h-3.5 w-3.5 text-white/60" />
            <span className="relative z-10 max-w-[7rem] truncate">
              {attraction.name}
            </span>
            <span className="relative z-10 hidden rounded-full bg-white/[0.075] px-1.5 py-0.5 text-[0.58rem] text-white/50 sm:inline">
              {attraction.queue}
            </span>
          </motion.div>
        );
      })}

      {!mapDisabled && !hasLiveMap && roster.map((player, index) => (
        <PlayerMarker
          key={player.id}
          player={player}
          index={index}
          reducedMotion={reducedMotion}
        />
      ))}

      {!mapDisabled && !hasLiveMap && roster
        .filter((player) => player.role === "Verstecker")
        .map((player, index) => (
          <motion.div
            key={`${player.id}-last-seen`}
            className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[0.62rem] font-medium text-white/50 backdrop-blur-xl"
            style={{
              left: `${Math.max(8, player.x - 7 - index)}%`,
              top: `${Math.min(88, player.y + 8 + index * 2)}%`
            }}
            animate={
              reducedMotion
                ? undefined
                : { scale: [1, 1.025, 1], opacity: [0.36, 0.68, 0.36] }
            }
            transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="h-2 w-2 rounded-full bg-white/55" />
            Zuletzt gesehen
          </motion.div>
        ))}

      {!mapDisabled && roster.length === 0 && !livePosition ? (
        <div className="absolute inset-x-4 top-1/2 z-30 -translate-y-1/2 rounded-[18px] border border-white/10 bg-black/70 p-4 text-center shadow-glow sm:left-1/2 sm:right-auto sm:w-[420px] sm:-translate-x-1/2 sm:rounded-[28px] sm:p-5">
          <div className="text-base font-semibold text-white sm:text-lg">Keine Spieler auf der Karte</div>
          <div className="mt-1.5 text-xs leading-snug text-white/55 sm:mt-2 sm:text-sm">
            Erstelle eine Lobby oder tritt mit einem Code bei. Danach erscheint dein Spielerpunkt hier.
          </div>
        </div>
      ) : null}

      {!mapDisabled ? <motion.div
        className="absolute left-[45%] top-[58%] z-10 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-white/[0.025]"
        animate={
          reducedMotion
            ? { scale: 1, opacity: scanActive ? 0.3 : 0.12 }
            : {
                scale: scanActive ? [0.62, 1.95] : [0.94, 1.08, 0.94],
                opacity: scanActive ? [0.72, 0] : [0.12, 0.24, 0.12]
              }
        }
        transition={{
          duration: scanActive ? 1.7 : 6.5,
          repeat: scanActive ? 1 : Infinity,
          ease: "easeOut"
        }}
      /> : null}

      <div className="absolute left-3 right-3 top-3 z-30 flex items-start justify-between gap-3">
        <div className="glass-panel rounded-[18px] p-2 text-white sm:rounded-[26px] sm:p-3">
          <div className="relative z-10 flex items-center gap-2 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-white/45">
            <SignalHigh className="h-3.5 w-3.5 text-white/60" />
            Live-Gebiet
          </div>
          <div className="relative z-10 mt-1 flex items-baseline gap-2">
            <span className="font-display text-base font-semibold sm:text-xl">
              {mapDisabled ? "Ohne Karte" : hasLiveMap ? "Live-Karte" : "Nordpark"}
            </span>
            <span className="rounded-full bg-white/[0.075] px-2 py-0.5 text-[0.62rem] font-semibold text-white/60">
              {mapDisabled ? "Hinweise" : livePosition ? `${livePosition.accuracy} m` : mode}
            </span>
          </div>
        </div>

        <div className="glass-panel hidden rounded-[24px] p-2 text-white sm:block">
          <div className="relative z-10 h-24 w-24 overflow-hidden rounded-[18px] border border-white/10 bg-[#0b0d0f]">
            <div className="absolute inset-0 bg-radar-grid [background-size:20px_20px] opacity-45" />
            {roster.map((player) => (
              <span
                key={player.id}
                className="absolute h-1.5 w-1.5 rounded-full shadow-glow"
                style={{
                  left: `${player.x}%`,
                  top: `${player.y}%`,
                  backgroundColor: player.color
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-[4.75rem] left-2 right-2 z-30 grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 sm:bottom-3 sm:left-3 sm:right-3 sm:gap-2">
        <div className="glass-panel grid grid-cols-3 gap-1 rounded-[18px] p-1 text-white sm:gap-2 sm:rounded-[26px] sm:p-2">
          <Metric icon={Wifi} label="Ping" value={inLobby ? "18 ms" : "--"} />
          <Metric icon={BatteryMedium} label="Akku" mobileValue="Eco" value="Schonend" />
          <Metric
            icon={Volume2}
            label="Status"
            value={matchStatus === "running" ? "Live" : inLobby ? "Setup" : "Leer"}
          />
        </div>
        <div className="glass-panel flex gap-1 rounded-[18px] p-1 sm:gap-2 sm:rounded-[26px] sm:p-2">
          <button
            title="Radarscan aktivieren"
            className="glass-button grid h-10 w-10 place-items-center rounded-[14px] text-white/80 sm:h-12 sm:w-12 sm:rounded-[20px]"
            onClick={onScan}
          >
            <ScanLine className="h-5 w-5" />
          </button>
          <button
            title="Live-Ping setzen"
            className="glass-button grid h-10 w-10 place-items-center rounded-[14px] text-white/70 sm:h-12 sm:w-12 sm:rounded-[20px]"
            onClick={onPing}
          >
            <MapPin className="h-5 w-5" />
          </button>
          <button
            title="Fangradius prüfen"
            className="glass-button grid h-10 w-10 place-items-center rounded-[14px] text-white/70 sm:h-12 sm:w-12 sm:rounded-[20px]"
            onClick={onCatchCheck}
          >
            <Crosshair className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="glass-panel absolute right-3 top-3 z-30 rounded-[16px] px-2.5 py-1.5 text-white sm:right-4 sm:top-28 sm:rounded-[24px] sm:px-3 sm:py-2">
        <div className="relative z-10 flex items-center gap-2 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-white/45">
          <Radio className="h-3.5 w-3.5 text-white/60" />
          Enthüllung
        </div>
        <div className="relative z-10 mt-0.5 font-display text-xl font-semibold sm:mt-1 sm:text-2xl">
          0:{String(revealSeconds).padStart(2, "0")}
        </div>
      </div>
    </div>
  );
}

function PlayerMarker({
  player,
  index,
  reducedMotion
}: {
  player: Player;
  index: number;
  reducedMotion: boolean;
}) {
  const isHider = player.role === "Verstecker";
  const isRevealed = player.status === "revealed" || player.role === "Sucher";

  return (
    <motion.div
      className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${player.x}%`, top: `${player.y}%` }}
      animate={
        reducedMotion
          ? undefined
          : {
              x: [0, index % 2 ? 2.2 : -2.2, 0],
              y: [0, index % 2 ? -2.8 : 2.8, 0]
            }
      }
      transition={{ duration: 6 + index, repeat: Infinity, ease: motionEase }}
    >
      <div
        className={cx(
          "relative grid h-12 w-12 place-items-center rounded-full border text-[0.68rem] font-semibold shadow-2xl backdrop-blur-xl",
          isRevealed
            ? "border-white/40 bg-white/[0.13] text-black"
            : "border-white/15 bg-black/30 text-white/55 blur-[0.25px]"
        )}
        style={{
          boxShadow: `0 0 34px ${player.color}36`
        }}
      >
        <span
          className="absolute inset-1 rounded-full opacity-85"
          style={{ backgroundColor: isRevealed ? player.color : "rgba(255,255,255,0.06)" }}
        />
        <span className="relative">{isHider && !isRevealed ? "?" : player.avatar}</span>
      </div>
      <div className="mt-1 flex justify-center">
        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-white/60 backdrop-blur-xl">
          {player.role}
        </span>
      </div>
    </motion.div>
  );
}

function Metric({
  icon: Icon,
  label,
  mobileValue,
  value
}: {
  icon: LucideIcon;
  label: string;
  mobileValue?: string;
  value: string;
}) {
  return (
    <div
      className="glass-card min-w-0 rounded-[18px] px-1.5 py-2 text-center sm:px-2.5 sm:text-left"
      title={`${label}: ${value}`}
    >
      <div className="relative z-10 flex items-center justify-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-white/40 sm:justify-start">
        <Icon className="h-3.5 w-3.5 text-white/60" />
        <span className="hidden truncate sm:inline">{label}</span>
      </div>
      <div className="relative z-10 mt-1 truncate text-[0.68rem] font-semibold text-white/90 sm:text-sm">
        <span className="sm:hidden">{mobileValue ?? value}</span>
        <span className="hidden sm:inline">{value}</span>
      </div>
    </div>
  );
}

function MapRoutes({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <svg
      className="absolute inset-0 z-0 h-full w-full opacity-75"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="seekrRoute" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="52%" stopColor="#d8f6ff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <motion.path
        d="M5 72 C 18 58, 18 38, 35 34 S 58 18, 75 30 S 87 61, 95 76"
        fill="none"
        stroke="url(#seekrRoute)"
        strokeWidth="3.2"
        strokeLinecap="round"
        animate={
          reducedMotion
            ? undefined
            : { pathLength: [0.92, 1, 0.92], opacity: [0.52, 0.9, 0.52] }
        }
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <path
        d="M12 22 C 32 28, 30 52, 49 55 S 76 48, 90 35"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.105"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path
        d="M22 88 C 39 76, 42 65, 53 62 S 72 74, 86 88"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.085"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
