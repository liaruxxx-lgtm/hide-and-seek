"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  Bell,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Crosshair,
  Crown,
  Download,
  Eye,
  Flag,
  Gauge,
  Globe2,
  History,
  LocateFixed,
  Lock,
  LucideIcon,
  Map,
  Mic2,
  Play,
  Plus,
  Radar,
  Radio,
  Settings,
  Shield,
  Shuffle,
  Smartphone,
  Sparkles,
  Target,
  Timer,
  Trophy,
  UserPlus,
  Users,
  Wifi,
  X,
  Zap
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PWARegister } from "@/app/components/PWARegister";
import { TacticalMap } from "@/app/components/TacticalMap";
import {
  abilityDeck,
  backendSystems,
  creatorTools,
  gameModes,
  matchEvents,
  socialSystems,
  type Player,
  type PlayerRole
} from "@/app/lib/game-data";
import { connectRealtimeLobby } from "@/app/lib/socket-client";
import { hasConfiguredDatabase } from "@/app/lib/supabase";
import { cx } from "@/app/lib/utils";

type MobileTab = "lobby" | "map" | "intel" | "studio";
type GpsStatus = "idle" | "requesting" | "tracking" | "blocked" | "weak";
type Privacy = "Privat" | "Öffentlich";
type MatchStatus = "setup" | "countdown" | "running" | "ended";
type RealtimeClient = Awaited<ReturnType<typeof connectRealtimeLobby>>;

const LOCAL_PLAYER_ID = "local-player";
const POSITION_UPDATE_INTERVAL_MS = 1000;
const LOCATION_ONBOARDING_KEY = "seekr-location-onboarding-v1";

const smoothSpring = {
  type: "spring",
  stiffness: 130,
  damping: 24,
  mass: 0.85
} as const;

const mobileTabs: Array<{ id: MobileTab; label: string; icon: LucideIcon }> = [
  { id: "lobby", label: "Lobby", icon: Users },
  { id: "map", label: "Karte", icon: Map },
  { id: "intel", label: "Lage", icon: Radio },
  { id: "studio", label: "Studio", icon: Camera }
];

function randomLobbyCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const raw = Array.from({ length: 6 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)]
  ).join("");
  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}

function makeLocalPlayer(name: string, role: PlayerRole = "Verstecker"): Player {
  return {
    id: LOCAL_PLAYER_ID,
    name: name.trim() || "Du",
    handle: "@du",
    role,
    team: "Host",
    avatar: (name.trim() || "Du").slice(0, 2).toUpperCase(),
    color: "#f4f8fb",
    x: 48,
    y: 58,
    ready: false,
    status: "live",
    battery: 100,
    signal: 98,
    xp: 0,
    trail: [
      [45, 61],
      [47, 59],
      [48, 58]
    ],
    perks: ["Radarscan", "Live-Ping"]
  };
}

export function SeekrApp() {
  const [roster, setRoster] = useState<Player[]>([]);
  const [activeTab, setActiveTab] = useState<MobileTab>("map");
  const [selectedMode, setSelectedMode] = useState("Freizeitpark");
  const [privacy, setPrivacy] = useState<Privacy>("Privat");
  const [playerName, setPlayerName] = useState("Du");
  const [lobbyCode, setLobbyCode] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [matchStatus, setMatchStatus] = useState<MatchStatus>("setup");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [highAccuracy, setHighAccuracy] = useState(true);
  const [backgroundTracking, setBackgroundTracking] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [testMode, setTestMode] = useState(false);
  const [revealSeconds, setRevealSeconds] = useState(43);
  const [countdown, setCountdown] = useState(0);
  const [scanActive, setScanActive] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [livePosition, setLivePosition] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [realtimeState, setRealtimeState] = useState<"lokal" | "verbunden">("lokal");
  const [selfId, setSelfId] = useState(LOCAL_PLAYER_ID);
  const [toast, setToast] = useState("Bereit zum Erstellen einer Lobby.");
  const [events, setEvents] = useState<string[]>([
    "Noch keine Spieler in der Lobby.",
    "Erstelle eine Lobby oder tritt mit einem Code bei."
  ]);
  const [isAndroidApp, setIsAndroidApp] = useState(false);
  const [locationOnboardingOpen, setLocationOnboardingOpen] = useState(true);

  const watchIdRef = useRef<number | null>(null);
  const lastPositionUpdateRef = useRef(0);
  const autoLocationRequestedRef = useRef(false);
  const lobbyCodeRef = useRef("");
  const matchStatusRef = useRef<MatchStatus>("setup");
  const realtimeRef = useRef<RealtimeClient>(null);

  const localPlayer =
    roster.find((player) => player.id === selfId) ??
    roster.find((player) => player.id === LOCAL_PLAYER_ID);
  const inLobby = Boolean(localPlayer && lobbyCode);
  const seekers = roster.filter((player) => player.role === "Sucher").length;
  const hiders = roster.filter((player) => player.role === "Verstecker").length;
  const allReady = roster.length > 0 && roster.every((player) => player.ready);
  const canStartMatch = roster.length >= 2 && allReady;
  const isHost = Boolean(localPlayer?.isHost);
  const selectedModeData = gameModes.find((mode) => mode.name === selectedMode);

  const notify = useCallback((message: string) => {
    setToast(message);
    setEvents((current) => [message, ...current].slice(0, 7));
  }, []);

  useEffect(() => {
    setIsAndroidApp(navigator.userAgent.includes("SEEKR-Android"));
    setLocationOnboardingOpen(
      window.localStorage.getItem(LOCATION_ONBOARDING_KEY) !== "answered"
    );
  }, []);

  useEffect(() => {
    let mounted = true;

    connectRealtimeLobby({
      onConnectionChange: (connected) => {
        if (!mounted) return;
        setRealtimeState(connected ? "verbunden" : "lokal");
        if (!connected) {
          lobbyCodeRef.current = "";
          matchStatusRef.current = "setup";
          setLobbyCode("");
          setRoster([]);
          setSelfId(LOCAL_PLAYER_ID);
          setMatchStatus("setup");
          setCountdown(0);
          setJoinError("Keine Serververbindung. Bitte versuche es erneut.");
          notify("Serververbindung unterbrochen. Die alte Lobby wurde geschlossen.");
        }
      },
      onError: (error) => {
        setJoinError(error.message);
        notify(error.message);
      },
      onSnapshot: (snapshot) => {
        const enteredLobby = Boolean(
          snapshot.code && snapshot.code !== lobbyCodeRef.current
        );
        const matchStarted =
          snapshot.status === "countdown" && matchStatusRef.current !== "countdown";
        lobbyCodeRef.current = snapshot.code;
        matchStatusRef.current = snapshot.status;

        setSelfId(snapshot.selfId || LOCAL_PLAYER_ID);
        setLobbyCode(snapshot.code);
        setRoster(snapshot.players);
        setCountdown(snapshot.countdown);
        setMatchStatus(snapshot.status);
        setSelectedMode(snapshot.mode);
        setPrivacy(snapshot.privacy);
        if (snapshot.code) {
          setJoinError("");
          setJoinOpen(false);
          if (enteredLobby) {
            setActiveTab("lobby");
          } else if (matchStarted) {
            setActiveTab(snapshot.mode === "Studio-Herausforderung" ? "studio" : "map");
          }
        }
      }
    }).then((client) => {
      if (!mounted) {
        client?.disconnect();
        return;
      }

      realtimeRef.current = client;
      setRealtimeState(client ? "verbunden" : "lokal");
    });

    return () => {
      mounted = false;
      realtimeRef.current?.disconnect();
    };
  }, [notify]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("seekr-settings");
      if (!saved) return;
      const parsed = JSON.parse(saved) as {
        backgroundTracking?: boolean;
        highAccuracy?: boolean;
        soundAlerts?: boolean;
        testMode?: boolean;
        voiceEnabled?: boolean;
      };
      if (typeof parsed.backgroundTracking === "boolean") {
        setBackgroundTracking(parsed.backgroundTracking);
      }
      if (typeof parsed.highAccuracy === "boolean") {
        setHighAccuracy(parsed.highAccuracy);
      }
      if (typeof parsed.soundAlerts === "boolean") {
        setSoundAlerts(parsed.soundAlerts);
      }
      if (typeof parsed.testMode === "boolean") {
        setTestMode(parsed.testMode);
      }
      if (typeof parsed.voiceEnabled === "boolean") {
        setVoiceEnabled(parsed.voiceEnabled);
      }
    } catch {
      window.localStorage.removeItem("seekr-settings");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "seekr-settings",
      JSON.stringify({
        backgroundTracking,
        highAccuracy,
        soundAlerts,
        testMode,
        voiceEnabled
      })
    );
  }, [backgroundTracking, highAccuracy, soundAlerts, testMode, voiceEnabled]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRevealSeconds((value) =>
        value <= 1
          ? Math.floor(
              (selectedModeData?.revealMin ?? 30) +
                Math.random() *
                  ((selectedModeData?.revealMax ?? 60) -
                    (selectedModeData?.revealMin ?? 30) +
                    1)
            )
          : value - 1
      );

      setCountdown((value) => {
        if (matchStatus !== "countdown") {
          return value;
        }
        if (value <= 1) {
          setMatchStatus("running");
          notify("Runde läuft. Die Karte ist aktiv.");
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [matchStatus, notify, selectedModeData]);

  useEffect(() => {
    setRevealSeconds(selectedModeData?.revealMax ?? 60);
  }, [selectedModeData]);

  useEffect(() => {
    const mover = window.setInterval(() => {
      setRoster((current) =>
        current.map((player, index) => {
          if (
            matchStatus !== "running" ||
            player.status === "caught" ||
            (typeof player.latitude === "number" && typeof player.longitude === "number")
          ) {
            return player;
          }

          const driftX = Math.sin(Date.now() / 3600 + index) * 0.45;
          const driftY = Math.cos(Date.now() / 4200 + index) * 0.34;
          const nextX = Math.min(92, Math.max(8, player.x + driftX));
          const nextY = Math.min(88, Math.max(12, player.y + driftY));

          return {
            ...player,
            x: nextX,
            y: nextY,
            trail: [...player.trail.slice(-2), [nextX, nextY]]
          };
        })
      );
    }, 2600);

    return () => window.clearInterval(mover);
  }, [matchStatus]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  function createLobby() {
    if (realtimeRef.current) {
      realtimeRef.current.createLobby({
        mode: selectedMode,
        name: playerName,
        position: livePosition,
        privacy
      });
      notify("Lobby wird erstellt...");
      return;
    }

    if (!testMode) {
      notify("Keine Serververbindung. Prüfe den Verbindungsstatus und versuche es erneut.");
      return;
    }

    const code = randomLobbyCode();
    const player = makeLocalPlayer(playerName);
    setLobbyCode(code);
    setRoster([player]);
    setMatchStatus("setup");
    setCountdown(0);
    setActiveTab("lobby");
    notify(`Lobby ${code} erstellt. Du bist jetzt in der Spielerliste.`);
  }

  function openJoinDialog() {
    setJoinError("");
    setJoinOpen(true);
    setJoinCode(lobbyCode || "");
  }

  function joinLobby() {
    const compact = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (compact.length !== 6) {
      const message = "Der Lobby-Code muss aus genau 6 Zeichen bestehen.";
      setJoinError(message);
      notify(message);
      return;
    }

    const formatted = `${compact.slice(0, 3)}-${compact.slice(3)}`;
    setJoinCode(formatted);
    setJoinError("");
    if (realtimeRef.current) {
      realtimeRef.current.joinLobby({
        code: formatted,
        name: playerName,
        position: livePosition
      });
      notify(`Beitritt zu ${formatted} wird versucht...`);
      return;
    }

    if (!testMode) {
      const message = "Keine Serververbindung. Beitreten ist gerade nicht möglich.";
      setJoinError(message);
      notify(message);
      return;
    }

    setLobbyCode(formatted);
    setRoster([makeLocalPlayer(playerName)]);
    setMatchStatus("setup");
    setJoinOpen(false);
    setActiveTab("lobby");
    notify(`Lobby ${formatted} beigetreten.`);
  }

  async function copyInvite() {
    if (!lobbyCode) {
      notify("Erstelle zuerst eine Lobby.");
      return;
    }

    try {
      await navigator.clipboard.writeText(lobbyCode);
      notify(`Code ${lobbyCode} kopiert.`);
    } catch {
      notify(`Code: ${lobbyCode}`);
    }
  }

  function toggleReady() {
    if (!inLobby) {
      notify("Erstelle oder betrete zuerst eine Lobby.");
      return;
    }

    realtimeRef.current?.emitReady(!localPlayer?.ready);
    if (!realtimeRef.current) {
      setRoster((current) =>
        current.map((player) =>
          player.id === LOCAL_PLAYER_ID
            ? { ...player, ready: !player.ready }
            : player
        )
      );
    }
    notify(localPlayer?.ready ? "Du bist nicht mehr bereit." : "Du bist bereit.");
  }

  function randomizeRoles() {
    if (!inLobby) {
      notify("Keine Lobby aktiv. Rollen können erst danach verteilt werden.");
      return;
    }

    if (!isHost) {
      notify("Nur der Host kann die Rollen verteilen.");
      return;
    }

    if (realtimeRef.current) {
      realtimeRef.current.randomizeRoles();
    } else {
      setRoster((current) =>
        current.map((player, index) => ({
          ...player,
          role: index === 0 ? "Sucher" : "Verstecker",
          status: "live"
        }))
      );
    }
    notify(
      roster.length < 2
        ? "Rolle gesetzt: Du bist Sucher. Für echte Verteilung braucht es weitere Geräte."
        : "Rollen wurden neu verteilt."
    );
  }

  function startMatch() {
    if (!inLobby) {
      notify("Erstelle oder betrete zuerst eine Lobby.");
      return;
    }

    if (!isHost) {
      notify("Nur der Host kann die Runde starten.");
      return;
    }

    if (roster.length < 2) {
      notify("Zum Starten werden mindestens 2 Spieler benötigt.");
      setActiveTab("lobby");
      return;
    }

    if (!allReady) {
      notify("Alle Spieler müssen bereit sein. Setze dich zuerst auf Bereit.");
      return;
    }

    if (realtimeRef.current) {
      realtimeRef.current.startMatch();
    } else {
      setMatchStatus("countdown");
      setCountdown(5);
    }
    setActiveTab(selectedMode === "Studio-Herausforderung" ? "studio" : "map");
    notify("Match startet in 5 Sekunden.");
  }

  function selectMode(mode: string) {
    if (inLobby && !isHost) {
      notify("Nur der Host kann den Spielmodus ändern.");
      return;
    }

    setSelectedMode(mode);
    if (inLobby && realtimeRef.current) {
      realtimeRef.current.setMode(mode);
      notify(`Spielmodus wird auf ${mode} geändert. Alle müssen erneut bereit sein.`);
    }
  }

  function leaveLobby() {
    realtimeRef.current?.leaveLobby();
    lobbyCodeRef.current = "";
    matchStatusRef.current = "setup";
    setRoster([]);
    setLobbyCode("");
    setMatchStatus("setup");
    setCountdown(0);
    setActiveTab("map");
    notify("Lobby verlassen. Es sind keine Demo-Spieler mehr aktiv.");
  }

  const applyPositionSnapshot = useCallback(
    (snapshot: { accuracy: number; latitude: number; longitude: number }) => {
      const now = Date.now();
      if (now - lastPositionUpdateRef.current < POSITION_UPDATE_INTERVAL_MS) return;
      lastPositionUpdateRef.current = now;

      setLivePosition(snapshot);
      setGpsStatus(snapshot.accuracy > 70 ? "weak" : "tracking");
      setRoster((current) =>
        current.map((player) =>
          player.id === selfId || player.id === LOCAL_PLAYER_ID
            ? {
                ...player,
                latitude: snapshot.latitude,
                longitude: snapshot.longitude,
                accuracy: snapshot.accuracy,
                signal: Math.max(55, Math.min(99, 110 - snapshot.accuracy))
              }
            : player
        )
      );
      realtimeRef.current?.emitPing(snapshot);
      notify(`GPS aktiv: ${snapshot.accuracy} m Genauigkeit.`);
    },
    [notify, selfId]
  );

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGpsStatus("blocked");
      notify("Dieser Browser unterstützt keine GPS-Ortung.");
      return;
    }

    setGpsStatus("requesting");
    notify("GPS-Freigabe angefragt.");
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        applyPositionSnapshot({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy)
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGpsStatus("blocked");
          notify("GPS-Zugriff wurde blockiert.");
          return;
        }

        setGpsStatus("weak");
        notify(
          error.code === error.TIMEOUT
            ? "Noch kein GPS-Fix. Geh ans Fenster oder nach draußen."
            : "GPS-Signal ist momentan nicht verfügbar."
        );
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: 30000,
        maximumAge: 5000
      }
    );
  }, [applyPositionSnapshot, highAccuracy, notify]);

  useEffect(() => {
    if (
      autoLocationRequestedRef.current ||
      window.localStorage.getItem(LOCATION_ONBOARDING_KEY) !== "answered" ||
      !("permissions" in navigator)
    ) {
      return;
    }

    autoLocationRequestedRef.current = true;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((permission) => {
        if (permission.state === "granted") requestLocation();
      })
      .catch(() => undefined);
  }, [requestLocation]);

  const answerLocationOnboarding = useCallback(
    (allow: boolean) => {
      window.localStorage.setItem(LOCATION_ONBOARDING_KEY, "answered");
      setLocationOnboardingOpen(false);
      if (allow) {
        requestLocation();
      } else {
        notify("Standort noch nicht freigegeben. Du kannst GPS später über „Ortung“ aktivieren.");
      }
    },
    [notify, requestLocation]
  );

  useEffect(() => {
    const handleNativeLocation = (event: Event) => {
      const snapshot = (
        event as CustomEvent<{
          accuracy: number;
          latitude: number;
          longitude: number;
        }>
      ).detail;
      if (!snapshot) return;
      applyPositionSnapshot({
        accuracy: Math.round(snapshot.accuracy),
        latitude: snapshot.latitude,
        longitude: snapshot.longitude
      });
    };

    window.addEventListener("seekr:native-location", handleNativeLocation);
    return () =>
      window.removeEventListener("seekr:native-location", handleNativeLocation);
  }, [applyPositionSnapshot]);

  useEffect(() => {
    window.addEventListener("seekr:native-location-granted", requestLocation);
    return () =>
      window.removeEventListener("seekr:native-location-granted", requestLocation);
  }, [requestLocation]);

  function triggerScan() {
    setScanActive(true);
    window.setTimeout(() => setScanActive(false), 1900);
    notify(matchStatus === "running" ? "Radarscan ausgelöst." : "Radarscan getestet.");
  }

  function dropPing() {
    if (!inLobby) {
      notify("Erstelle zuerst eine Lobby, um einen Ping zu setzen.");
      return;
    }
    if (livePosition) {
      realtimeRef.current?.emitPing(livePosition);
    }
    notify("Live-Ping auf deiner aktuellen Position gesetzt.");
  }

  function checkCatchRadius() {
    if (!inLobby) {
      notify("Kein aktiver Spieler in der Lobby.");
      return;
    }
    notify(roster.length < 2 ? "Solo-Test: kein Gegner im Fangradius." : "Fangradius geprüft.");
  }

  function useAbility(name: string) {
    if (!inLobby) {
      notify("Fähigkeiten sind erst in einer Lobby aktiv.");
      return;
    }
    notify(`${name} aktiviert.`);
  }

  function updateSetting(label: string, nextValue: boolean, setter: (value: boolean) => void) {
    setter(nextValue);
    notify(`${label}: ${nextValue ? "an" : "aus"}.`);
  }

  const gpsCopy = useMemo(() => {
    if (gpsStatus === "tracking") {
      return livePosition ? `${livePosition.accuracy} m` : "Ortung aktiv";
    }
    if (gpsStatus === "requesting") return "Freigabe läuft";
    if (gpsStatus === "weak") return "Signal schwach";
    if (gpsStatus === "blocked") return "Zugriff blockiert";
    return "GPS aus";
  }, [gpsStatus, livePosition]);

  return (
    <MotionConfig reducedMotion={isAndroidApp ? "always" : "user"}>
    <main
      className={cx(
        "premium-shell relative text-frost lg:h-dvh lg:overflow-hidden",
        activeTab === "map"
          ? "h-dvh overflow-hidden"
          : "min-h-dvh overflow-x-hidden"
      )}
    >
      <PWARegister />
      <div className="stone-noise pointer-events-none fixed inset-0 opacity-70" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-white/30" />

      <div
        className={cx(
          "relative mx-auto flex w-full max-w-[1580px] flex-col gap-3 px-3 pb-[5.5rem] pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-4 sm:px-5 sm:pb-5 lg:h-dvh lg:min-h-0",
          activeTab === "map" ? "h-dvh min-h-0" : "min-h-dvh"
        )}
      >
        <TopBar
          allReady={allReady}
          countdown={countdown}
          gpsCopy={gpsCopy}
          gpsStatus={gpsStatus}
          hiders={hiders}
          inLobby={inLobby}
          lobbyCode={lobbyCode}
          matchStatus={matchStatus}
          privacy={privacy}
          realtimeState={realtimeState}
          requestLocation={requestLocation}
          seekers={seekers}
        />

        <div className="glass-panel rounded-[18px] px-3 py-2 text-xs font-medium text-white/78 sm:rounded-[24px] sm:px-4 sm:py-3 sm:text-sm">
          <span className="relative z-10">{toast}</span>
        </div>

        <section className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[340px_minmax(0,1fr)_360px] xl:grid-cols-[370px_minmax(0,1fr)_390px]">
          <motion.aside
            className={cx(
              "min-h-0",
              activeTab === "lobby" ? "block" : "hidden lg:block"
            )}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={smoothSpring}
          >
            <LobbyPanel
              allReady={allReady}
              canStartMatch={canStartMatch}
              copyInvite={copyInvite}
              createLobby={createLobby}
              inLobby={inLobby}
              isHost={isHost}
              leaveLobby={leaveLobby}
              localPlayer={localPlayer}
              lobbyCode={lobbyCode}
              openJoinDialog={openJoinDialog}
              playerName={playerName}
              privacy={privacy}
              randomizeRoles={randomizeRoles}
              roster={roster}
              selectedMode={selectedMode}
              selectedModeData={selectedModeData}
              setPlayerName={setPlayerName}
              setPrivacy={setPrivacy}
              setSelectedMode={selectMode}
              startMatch={startMatch}
              toggleReady={toggleReady}
            />
          </motion.aside>

          <motion.section
            className={cx(
              "h-full min-h-0",
              activeTab === "map" ? "block" : "hidden lg:block"
            )}
            initial={{ opacity: 0, scale: 0.982, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={smoothSpring}
          >
            <TacticalMap
              inLobby={inLobby}
              livePosition={livePosition}
              matchStatus={matchStatus}
              mode={selectedMode}
              onCatchCheck={checkCatchRadius}
              onPing={dropPing}
              onScan={triggerScan}
              revealSeconds={revealSeconds}
              roster={roster}
              scanActive={scanActive}
              reducedMotion={isAndroidApp}
            />
          </motion.section>

          <motion.aside
            className={cx(
              "min-h-0",
              activeTab === "intel" || activeTab === "studio"
                ? "block"
                : "hidden lg:block"
            )}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={smoothSpring}
          >
            <AnimatePresence mode="wait">
              {activeTab === "studio" ? (
                <motion.div
                  key="studio"
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={smoothSpring}
                >
                  <StudioPanel events={events} notify={notify} />
                </motion.div>
              ) : (
                <motion.div
                  key="intel"
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={smoothSpring}
                >
                  <IntelPanel
                    backgroundTracking={backgroundTracking}
                    gpsCopy={gpsCopy}
                    highAccuracy={highAccuracy}
                    setSoundAlerts={(value) => updateSetting("Sound-Hinweise", value, setSoundAlerts)}
                    setBackgroundTracking={(value) =>
                      updateSetting("Hintergrund-Ortung", value, setBackgroundTracking)
                    }
                    setHighAccuracy={(value) =>
                      updateSetting("Hochpräzises GPS", value, setHighAccuracy)
                    }
                    setTestMode={(value) => updateSetting("Testmodus", value, setTestMode)}
                    setVoiceEnabled={(value) =>
                      updateSetting("Live-Sprachkanal", value, setVoiceEnabled)
                    }
                    soundAlerts={soundAlerts}
                    testMode={testMode}
                    onUseAbility={useAbility}
                    voiceEnabled={voiceEnabled}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>
        </section>
      </div>

      <JoinDialog
        joinCode={joinCode}
        joinError={joinError}
        joinOpen={joinOpen}
        joinLobby={joinLobby}
        setJoinCode={(value) => {
          setJoinCode(value);
          setJoinError("");
        }}
        setJoinOpen={setJoinOpen}
      />
      <LocationOnboardingDialog
        onAllow={() => answerLocationOnboarding(true)}
        onLater={() => answerLocationOnboarding(false)}
        open={locationOnboardingOpen}
      />
      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </main>
    </MotionConfig>
  );
}

function LocationOnboardingDialog({
  onAllow,
  onLater,
  open
}: {
  onAllow: () => void;
  onLater: () => void;
  open: boolean;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          aria-label="Standortzugriff"
          aria-modal="true"
          className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
        >
          <motion.div
            className="glass-panel w-full max-w-sm rounded-[32px] p-5 sm:p-6"
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 18 }}
            transition={smoothSpring}
          >
            <div className="relative z-10 grid h-12 w-12 place-items-center rounded-[20px] border border-white/15 bg-white/[0.08] shadow-glow">
              <LocateFixed className="h-6 w-6 text-frost" />
            </div>
            <h2 className="relative z-10 mt-4 font-display text-2xl font-semibold text-white">
              Standort freigeben?
            </h2>
            <p className="relative z-10 mt-2 text-sm leading-relaxed text-white/60">
              SEEKR benötigt deinen Standort für GPS, die Live-Karte und den Fangradius.
              Ohne Zugriff funktionieren diese Spielfunktionen nicht.
            </p>
            <p className="relative z-10 mt-3 text-xs leading-relaxed text-white/40">
              Dein Gerät zeigt als Nächstes die offizielle Standortabfrage an. Du kannst die
              Berechtigung später in den Browser- oder App-Einstellungen ändern.
            </p>
            <div className="relative z-10 mt-5 grid gap-2">
              <button
                autoFocus
                className="glass-button-active w-full rounded-[22px] px-4 py-3 text-sm font-semibold"
                onClick={onAllow}
                type="button"
              >
                Standort freigeben
              </button>
              <button
                className="glass-button w-full rounded-[22px] px-4 py-3 text-sm font-semibold text-white/70"
                onClick={onLater}
                type="button"
              >
                Später
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function TopBar({
  allReady,
  countdown,
  gpsCopy,
  gpsStatus,
  hiders,
  inLobby,
  lobbyCode,
  matchStatus,
  privacy,
  realtimeState,
  requestLocation,
  seekers
}: {
  allReady: boolean;
  countdown: number;
  gpsCopy: string;
  gpsStatus: GpsStatus;
  hiders: number;
  inLobby: boolean;
  lobbyCode: string;
  matchStatus: MatchStatus;
  privacy: Privacy;
  realtimeState: "lokal" | "verbunden";
  requestLocation: () => void;
  seekers: number;
}) {
  const statusText =
    matchStatus === "running"
      ? "Live"
      : matchStatus === "countdown"
        ? `Start ${countdown}`
        : allReady
          ? "Bereit"
          : "Setup";

  return (
    <header className="glass-panel grid gap-2 rounded-[22px] p-2 sm:gap-3 sm:rounded-[32px] sm:p-3 lg:grid-cols-[1fr_auto]">
      <div className="relative z-10 flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[16px] border border-white/15 bg-white/[0.08] shadow-glow sm:h-12 sm:w-12 sm:rounded-[24px]">
          <Crosshair className="h-5 w-5 text-frost sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <h1 className="font-display text-3xl font-semibold leading-none tracking-normal text-white sm:text-5xl">
              SEEKR
            </h1>
            <StatusPill icon={Lock} text={privacy} />
            <StatusPill icon={Wifi} text={realtimeState} />
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[0.68rem] font-medium text-white/50 sm:mt-1.5 sm:gap-2 sm:text-xs">
            <span>{inLobby ? `Lobby ${lobbyCode}` : "Keine Lobby"}</span>
            <span>{seekers} Sucher</span>
            <span>{hiders} Verstecker</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:min-w-[520px]">
        <TopMetric icon={Timer} label="Status" value={statusText} />
        <div className="hidden sm:block">
          <TopMetric icon={Globe2} label="Region" value="Lokal" />
        </div>
        <TopMetric
          icon={LocateFixed}
          label="GPS"
          tone={gpsStatus === "blocked" ? "warm" : "cool"}
          value={gpsCopy}
        />
        <button
          className="glass-button flex min-w-0 items-center justify-center gap-1.5 rounded-[16px] px-2 py-2 text-xs font-semibold text-frost sm:gap-2 sm:rounded-[22px] sm:px-3 sm:py-2.5 sm:text-sm"
          onClick={requestLocation}
          title="GPS-Ortung aktivieren"
        >
          <LocateFixed className="h-4 w-4 shrink-0" />
          <span className="truncate">Ortung</span>
        </button>
      </div>
    </header>
  );
}

function LobbyPanel({
  allReady,
  canStartMatch,
  copyInvite,
  createLobby,
  inLobby,
  isHost,
  leaveLobby,
  lobbyCode,
  localPlayer,
  openJoinDialog,
  playerName,
  privacy,
  randomizeRoles,
  roster,
  selectedMode,
  selectedModeData,
  setPlayerName,
  setPrivacy,
  setSelectedMode,
  startMatch,
  toggleReady
}: {
  allReady: boolean;
  canStartMatch: boolean;
  copyInvite: () => void;
  createLobby: () => void;
  inLobby: boolean;
  isHost: boolean;
  leaveLobby: () => void;
  lobbyCode: string;
  localPlayer?: Player;
  openJoinDialog: () => void;
  playerName: string;
  privacy: Privacy;
  randomizeRoles: () => void;
  roster: Player[];
  selectedMode: string;
  selectedModeData?: (typeof gameModes)[number];
  setPlayerName: (name: string) => void;
  setPrivacy: (privacy: Privacy) => void;
  setSelectedMode: (mode: string) => void;
  startMatch: () => void;
  toggleReady: () => void;
}) {
  return (
    <div className="grid gap-3 lg:max-h-[calc(100dvh-160px)] lg:overflow-y-auto lg:pr-1">
      <Panel title="Lobby" icon={Users}>
        <div className="grid gap-3">
          {!inLobby ? (
            <label className="glass-card block rounded-[18px] p-2.5 sm:rounded-[24px] sm:p-3">
              <span className="relative z-10 block text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-white/40">
                Dein Name
              </span>
              <input
                aria-label="Dein Name"
                className="relative z-10 mt-1.5 w-full rounded-[14px] border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-white/30 sm:mt-2 sm:rounded-[18px]"
                maxLength={18}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="Du"
                value={playerName}
              />
            </label>
          ) : null}

          <div className="glass-card grid grid-cols-[1fr_auto] gap-2 rounded-[24px] p-2">
            <div className="relative z-10 min-w-0 px-2 py-1">
              <div className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-white/40">
                Einladungscode
              </div>
              <div className="mt-1 truncate font-display text-2xl font-semibold text-white">
                <span data-testid="lobby-code">{lobbyCode || "Noch keine Lobby"}</span>
              </div>
            </div>
            <button
              title="Einladungscode kopieren"
              className="glass-button relative z-10 grid h-12 w-12 place-items-center rounded-[20px] text-white/80"
              onClick={copyInvite}
            >
              <Copy className="h-5 w-5" />
            </button>
          </div>

          {!inLobby ? (
          <div className="grid grid-cols-2 gap-1 rounded-[18px] border border-white/10 bg-black/20 p-1 sm:rounded-[24px]">
            {(["Privat", "Öffentlich"] as const).map((option) => (
              <button
                key={option}
                className={cx(
                  "rounded-[19px] px-3 py-2.5 text-sm font-semibold transition",
                  privacy === option
                    ? "glass-button-active"
                    : "text-white/60 hover:bg-white/[0.065]"
                )}
                onClick={() => setPrivacy(option)}
              >
                {option}
              </button>
            ))}
          </div>
          ) : null}

          {inLobby ? (
            isHost ? (
              <div className="grid grid-cols-2 gap-2">
                <ActionButton icon={Shuffle} label="Rollen mischen" onClick={randomizeRoles} />
                <ActionButton
                  icon={Play}
                  label={
                    roster.length < 2
                      ? "Mind. 2 Spieler"
                      : allReady
                        ? "Runde starten"
                        : "Warte auf Spieler"
                  }
                  onClick={startMatch}
                  active={canStartMatch}
                  disabled={!canStartMatch}
                />
              </div>
            ) : (
              <div className="glass-card rounded-[18px] px-3 py-2.5 text-center text-sm text-white/60">
                Der Host startet die Runde, sobald alle bereit sind.
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <ActionButton icon={Plus} label="Erstellen" onClick={createLobby} active />
              <ActionButton icon={UserPlus} label="Beitreten" onClick={openJoinDialog} />
            </div>
          )}

          {inLobby ? (
            <button
              className="glass-button rounded-[22px] px-3 py-2.5 text-sm font-semibold text-white/70"
              onClick={leaveLobby}
            >
              Lobby verlassen
            </button>
          ) : null}
        </div>
      </Panel>

      <Panel title="Spieler" icon={Crown}>
        {roster.length === 0 ? (
          <EmptyState
            title="Noch keine Spieler"
            text="Die Liste bleibt leer, bis du eine Lobby erstellst oder einem Code beitrittst."
          />
        ) : (
          <div className="grid gap-2" data-testid="player-list">
            {roster.map((player) => (
              <div
                key={player.id}
                className="glass-card grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[24px] p-2.5"
                data-player-name={player.name}
              >
                <div
                  className="relative z-10 grid h-11 w-11 place-items-center rounded-[18px] border border-white/25 text-xs font-semibold text-black shadow-glow"
                  style={{ backgroundColor: player.color }}
                >
                  {player.avatar}
                </div>
                <div className="relative z-10 min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-semibold text-white/90">
                      {player.name}
                    </span>
                    {player.team === "Host" ? (
                      <Crown className="h-3.5 w-3.5 shrink-0 text-frost/75" />
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1.5 text-[0.68rem] font-medium text-white/40">
                    <span>{player.role}</span>
                    <span>{player.team}</span>
                    <span>{player.signal}% Signal</span>
                  </div>
                </div>
                <button
                  className={cx(
                    "relative z-10 rounded-full px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em]",
                    player.ready
                      ? "bg-white/15 text-white/85"
                      : "bg-white/[0.055] text-white/40"
                  )}
                  onClick={player.id === localPlayer?.id ? toggleReady : undefined}
                >
                  {player.ready ? "Bereit" : "Wartet"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Bereitschaft" icon={Flag}>
        <div className="glass-card rounded-[18px] p-2.5 sm:rounded-[24px] sm:p-3">
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white/90">
                <span data-testid="selected-mode">{selectedModeData?.name ?? selectedMode}</span>
              </div>
              <div className="mt-0.5 text-xs leading-snug text-white/40 sm:mt-1">
                Alle bereit? Dann kann der Host starten.
              </div>
            </div>
            <button
              className={cx(
                "rounded-[16px] px-3 py-2 text-sm font-semibold transition sm:rounded-[20px] sm:px-4 sm:py-2.5",
                localPlayer?.ready ? "glass-button-active" : "glass-button text-white/70"
              )}
              onClick={toggleReady}
            >
              {localPlayer?.ready ? "Bereit" : "Bereit?"}
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Spielmodi" icon={Flag}>
        <label className="block lg:hidden">
          <span className="sr-only">Spielmodus auswählen</span>
          <select
            className="w-full rounded-[16px] border border-white/10 bg-[#181b1f] px-3 py-2.5 text-sm font-semibold text-white outline-none"
            onChange={(event) => setSelectedMode(event.target.value)}
            disabled={inLobby && !isHost}
            value={selectedMode}
          >
            {gameModes.map((mode) => (
              <option key={mode.name} value={mode.name}>
                {mode.name}
              </option>
            ))}
          </select>
          <span className="mt-2 block text-xs leading-snug text-white/45">
            {selectedModeData?.detail}
          </span>
        </label>

        <div className="hidden gap-2 lg:grid">
          {gameModes.map((mode) => {
            const Icon = mode.icon;
            const active = selectedMode === mode.name;

            return (
              <button
                key={mode.name}
                data-mode={mode.name}
                disabled={inLobby && !isHost}
                className={cx(
                  "glass-card grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[24px] p-3 text-left transition",
                  active ? "border-white/30 bg-white/[0.09]" : "hover:bg-white/[0.06]"
                )}
                onClick={() => setSelectedMode(mode.name)}
              >
                <Icon
                  className={cx(
                    "relative z-10 h-5 w-5",
                    active ? "text-frost" : "text-white/40"
                  )}
                />
                <span className="relative z-10 min-w-0">
                  <span className="block truncate text-sm font-semibold text-white/90">
                    {mode.name}
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-white/45">
                    {mode.detail}
                  </span>
                </span>
                {active ? <Check className="relative z-10 h-4 w-4 text-frost" /> : null}
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function IntelPanel({
  backgroundTracking,
  gpsCopy,
  highAccuracy,
  setBackgroundTracking,
  setHighAccuracy,
  setSoundAlerts,
  setTestMode,
  setVoiceEnabled,
  soundAlerts,
  testMode,
  onUseAbility,
  voiceEnabled
}: {
  backgroundTracking: boolean;
  gpsCopy: string;
  highAccuracy: boolean;
  setBackgroundTracking: (value: boolean) => void;
  setHighAccuracy: (value: boolean) => void;
  setSoundAlerts: (value: boolean) => void;
  setTestMode: (value: boolean) => void;
  setVoiceEnabled: (value: boolean) => void;
  soundAlerts: boolean;
  testMode: boolean;
  onUseAbility: (name: string) => void;
  voiceEnabled: boolean;
}) {
  return (
    <div className="grid gap-3 lg:max-h-[calc(100dvh-160px)] lg:overflow-y-auto lg:pr-1">
      <Panel title="Lagebild" icon={Radar}>
        <div className="grid grid-cols-2 gap-2">
          <IntelStat icon={Clock3} label="Enthüllung" value="30-60 s" />
          <IntelStat icon={Target} label="Genauigkeit" value="+/- 42 m" />
          <IntelStat icon={Crosshair} label="Fangradius" value="22 m" />
          <IntelStat icon={Eye} label="Nebel" value="Adaptiv" />
        </div>
      </Panel>

      <Panel title="Fähigkeiten" icon={Zap}>
        <div className="grid gap-2">
          {abilityDeck.map((ability) => {
            const Icon = ability.icon;
            return (
              <button
                key={ability.name}
                className="glass-card grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[24px] p-3 text-left transition hover:bg-white/[0.06]"
                onClick={() => onUseAbility(ability.name)}
              >
                <Icon className="relative z-10 h-5 w-5 text-frost/80" />
                <span className="relative z-10 min-w-0">
                  <span className="block truncate text-sm font-semibold text-white/90">
                    {ability.name}
                  </span>
                  <span className="mt-1 block text-xs text-white/40">
                    {ability.role} | {ability.detail}
                  </span>
                </span>
                <span className="relative z-10 rounded-full bg-white/[0.075] px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-white/60">
                  {ability.cooldown}
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="Einstellungen" icon={Shield}>
        <div className="grid gap-2">
          <ToggleRow
            active={highAccuracy}
            icon={Gauge}
            label="Hochpräzises GPS"
            value={`${highAccuracy ? "An" : "Aus"} · ${gpsCopy}`}
            onClick={() => setHighAccuracy(!highAccuracy)}
          />
          <ToggleRow
            active={backgroundTracking}
            icon={Smartphone}
            label="Hintergrund-Ortung"
            value={backgroundTracking ? "An · PWA-Sitzung" : "Aus"}
            onClick={() => setBackgroundTracking(!backgroundTracking)}
          />
          <ToggleRow
            active={voiceEnabled}
            icon={Mic2}
            label="Live-Sprachkanal"
            value={voiceEnabled ? "An · Teamkanal" : "Aus"}
            onClick={() => setVoiceEnabled(!voiceEnabled)}
          />
          <ToggleRow
            active={soundAlerts}
            icon={Bell}
            label="Sound-Hinweise"
            value={soundAlerts ? "An · Nähe und Reveal" : "Aus"}
            onClick={() => setSoundAlerts(!soundAlerts)}
          />
          <ToggleRow
            active={testMode}
            icon={Settings}
            label="Testmodus"
            value={testMode ? "An · lokale Simulation" : "Aus"}
            onClick={() => setTestMode(!testMode)}
          />
          <StatusRow
            icon={Shield}
            label="Anmeldung"
            value={hasConfiguredDatabase ? "Supabase verbunden" : "Lokal"}
          />
        </div>
      </Panel>

      <Panel title="Sozial" icon={Sparkles}>
        <div className="grid grid-cols-2 gap-2">
          {socialSystems.map((system) => {
            const Icon = system.icon;
            return (
              <div key={system.label} className="glass-card rounded-[24px] p-3">
                <div className="relative z-10 flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white/40">
                  <Icon className="h-3.5 w-3.5 text-frost/70" />
                  <span className="truncate">{system.label}</span>
                </div>
                <div className="relative z-10 mt-1 truncate text-sm font-semibold text-white/90">
                  {system.value}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Betrieb" icon={Settings}>
        <div className="grid gap-2">
          {backendSystems.map((system) => (
            <div
              key={system.label}
              className="glass-card grid grid-cols-[1fr_auto] items-center gap-3 rounded-[24px] px-3 py-2.5"
            >
              <div className="relative z-10 min-w-0">
                <div className="truncate text-sm font-semibold text-white/90">
                  {system.label}
                </div>
                <div className="mt-0.5 truncate text-xs text-white/40">
                  {system.value}
                </div>
              </div>
              <span className="relative z-10 rounded-full bg-white/[0.075] px-2 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-white/60">
                {system.state}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function StudioPanel({
  events,
  notify
}: {
  events: string[];
  notify: (message: string) => void;
}) {
  return (
    <div className="grid gap-3 lg:max-h-[calc(100dvh-160px)] lg:overflow-y-auto lg:pr-1">
      <Panel title="Studio" icon={Camera}>
        <div className="grid grid-cols-2 gap-2">
          {creatorTools.map((tool, index) => (
            <button
              key={tool}
              className={cx(
                "rounded-[24px] px-3 py-3 text-left text-sm font-semibold transition",
                index === 0
                  ? "glass-button-active"
                  : "glass-button text-white/75"
              )}
              onClick={() => notify(`${tool} geöffnet.`)}
            >
              {tool}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Wiedergabe" icon={History}>
        <div className="glass-card overflow-hidden rounded-[24px]">
          <div className="relative z-10 h-44">
            <div className="absolute inset-0 tactical-map-bg opacity-90" />
            <div className="absolute inset-0 bg-radar-grid [background-size:36px_36px] opacity-35" />
            <motion.div
              className="absolute left-[20%] top-[56%] h-2.5 w-2.5 rounded-full bg-white shadow-glow"
              animate={{ left: ["20%", "52%", "77%"], top: ["56%", "42%", "64%"] }}
              transition={{ duration: 6, repeat: Infinity, ease: [0.19, 1, 0.22, 1] }}
            />
            <div className="glass-panel absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-[22px] p-2">
              <button
                title="Wiedergabe abspielen"
                className="glass-button-active relative z-10 grid h-10 w-10 place-items-center rounded-[17px]"
                onClick={() => notify("Wiedergabe gestartet.")}
              >
                <Play className="h-4 w-4" />
              </button>
              <div className="relative z-10 h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-white/80"
                  animate={{ width: ["8%", "76%", "8%"] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
              <span className="relative z-10 text-xs font-semibold text-white/60">
                9:16
              </span>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Höhepunkte" icon={Trophy}>
        <div className="grid gap-2">
          {["TikTok-Kurzvideo", "YouTube-Kurzvideo", "Kinoreifer Rückblick"].map(
            (clip) => (
              <button
                key={clip}
                className="glass-card grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[24px] p-3 text-left transition hover:bg-white/[0.06]"
                onClick={() => notify(`${clip} vorbereitet.`)}
              >
                <Download className="relative z-10 h-5 w-5 text-frost/75" />
                <span className="relative z-10 min-w-0">
                  <span className="block truncate text-sm font-semibold text-white/90">
                    {clip}
                  </span>
                  <span className="mt-1 block text-xs text-white/40">
                    Automatisch untertitelter Spielmoment
                  </span>
                </span>
                <ChevronRight className="relative z-10 h-4 w-4 text-white/35" />
              </button>
            )
          )}
        </div>
      </Panel>

      <Panel title="Live-Ereignisse" icon={Bell}>
        <div className="grid gap-2">
          {[...events, ...matchEvents].slice(0, 7).map((event, index) => (
            <div
              key={`${event}-${index}`}
              className="glass-card rounded-[24px] px-3 py-2.5 text-sm leading-snug text-white/70"
            >
              <span className="relative z-10 block">{event}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function JoinDialog({
  joinCode,
  joinError,
  joinLobby,
  joinOpen,
  setJoinCode,
  setJoinOpen
}: {
  joinCode: string;
  joinError: string;
  joinLobby: () => void;
  joinOpen: boolean;
  setJoinCode: (value: string) => void;
  setJoinOpen: (value: boolean) => void;
}) {
  return (
    <AnimatePresence>
      {joinOpen ? (
        <motion.div
          aria-label="Lobby beitreten"
          className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-4 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
        >
          <motion.div
            className="glass-panel w-full max-w-sm rounded-[32px] p-4"
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 18 }}
            transition={smoothSpring}
          >
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div>
                <div className="font-display text-xl font-semibold text-white">
                  Lobby beitreten
                </div>
                <div className="mt-1 text-sm text-white/50">
                  Gib den Code deines Freundes ein.
                </div>
              </div>
              <button
                className="glass-button grid h-10 w-10 place-items-center rounded-[18px] text-white/70"
                onClick={() => setJoinOpen(false)}
                title="Schließen"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              aria-label="Lobby-Code"
              autoFocus
              className="relative z-10 mt-4 w-full rounded-[22px] border border-white/10 bg-black/25 px-4 py-3 text-lg font-semibold uppercase text-white outline-none transition focus:border-white/35"
              onChange={(event) => setJoinCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  joinLobby();
                }
              }}
              placeholder="ABC-123"
              value={joinCode}
            />
            {joinError ? (
              <div
                className="relative z-10 mt-2 rounded-[14px] border border-hazard/30 bg-hazard/10 px-3 py-2 text-sm text-white/80"
                role="alert"
              >
                {joinError}
              </div>
            ) : null}
            <button
              className="glass-button-active relative z-10 mt-3 w-full rounded-[22px] px-4 py-3 text-sm font-semibold"
              onClick={joinLobby}
            >
              Beitreten
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Panel({
  children,
  icon: Icon,
  title
}: {
  children: React.ReactNode;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className="glass-panel rounded-[22px] p-2.5 sm:rounded-[32px] sm:p-3">
      <div className="relative z-10 mb-2 flex items-center justify-between gap-3 sm:mb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-[14px] border border-white/10 bg-white/[0.065] sm:h-9 sm:w-9 sm:rounded-[18px]">
            <Icon className="h-4 w-4 text-frost/75 sm:h-[18px] sm:w-[18px]" />
          </span>
          <h2 className="truncate font-display text-sm font-semibold uppercase tracking-[0.14em] text-white/75">
            {title}
          </h2>
        </div>
        <span className="h-1.5 w-1.5 rounded-full bg-white/70 shadow-glow" />
      </div>
      <div className="relative z-10">{children}</div>
    </section>
  );
}

function EmptyState({ text, title }: { text: string; title: string }) {
  return (
    <div className="glass-card rounded-[24px] p-4">
      <div className="relative z-10 text-sm font-semibold text-white/85">{title}</div>
      <div className="relative z-10 mt-1 text-sm leading-snug text-white/45">{text}</div>
    </div>
  );
}

function ActionButton({
  active = false,
  disabled = false,
  icon: Icon,
  label,
  onClick
}: {
  active?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      title={label}
      className={cx(
        "flex min-w-0 items-center justify-center gap-2 rounded-[22px] px-3 py-2.5 text-sm font-semibold",
        active ? "glass-button-active" : "glass-button text-white/75",
        disabled && "cursor-not-allowed opacity-45"
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function TopMetric({
  icon: Icon,
  label,
  tone = "cool",
  value
}: {
  icon: LucideIcon;
  label: string;
  tone?: "cool" | "warm";
  value: string;
}) {
  return (
    <div className="glass-card min-w-0 rounded-[16px] px-2 py-1.5 sm:rounded-[22px] sm:px-3 sm:py-2">
      <div className="relative z-10 flex items-center gap-1 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-white/40 sm:gap-1.5 sm:text-[0.62rem]">
        <Icon
          className={cx(
            "h-3.5 w-3.5",
            tone === "warm" ? "text-hazard" : "text-frost/70"
          )}
        />
        <span className="truncate">{label}</span>
      </div>
      <div className="relative z-10 mt-0.5 truncate text-xs font-semibold text-white/90 sm:mt-1 sm:text-sm">
        {value}
      </div>
    </div>
  );
}

function StatusPill({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-white/[0.07] px-2 py-0.5 text-[0.56rem] font-semibold uppercase tracking-[0.12em] text-white/60 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[0.64rem]">
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  );
}

function IntelStat({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-card rounded-[24px] p-3">
      <div className="relative z-10 flex items-center gap-2 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-white/40">
        <Icon className="h-3.5 w-3.5 text-frost/70" />
        <span className="truncate">{label}</span>
      </div>
      <div className="relative z-10 mt-1 truncate font-display text-lg font-semibold text-white/90">
        {value}
      </div>
    </div>
  );
}

function ToggleRow({
  active,
  icon: Icon,
  label,
  onClick,
  value
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  value: string;
}) {
  return (
    <button
      className="glass-card grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[24px] p-3 text-left transition hover:bg-white/[0.06]"
      onClick={onClick}
      type="button"
    >
      <Icon className="relative z-10 h-5 w-5 text-frost/70" />
      <span className="relative z-10 min-w-0">
        <span className="block truncate text-sm font-semibold text-white/90">
          {label}
        </span>
        <span className="mt-1 block truncate text-xs text-white/40">
          {value}
        </span>
      </span>
      <span
        className={cx(
          "relative z-10 h-6 w-11 rounded-full border transition",
          active
            ? "border-white/30 bg-white/20"
            : "border-white/10 bg-white/[0.045]"
        )}
      >
        <span
          className={cx(
            "absolute top-1 h-3.5 w-3.5 rounded-full transition-all duration-500 ease-out",
            active ? "left-6 bg-white shadow-glow" : "left-1 bg-white/40"
          )}
        />
      </span>
    </button>
  );
}

function StatusRow({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-card grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[24px] p-3 text-left">
      <Icon className="relative z-10 h-5 w-5 text-frost/70" />
      <span className="relative z-10 min-w-0">
        <span className="block truncate text-sm font-semibold text-white/90">
          {label}
        </span>
        <span className="mt-1 block truncate text-xs text-white/40">
          {value}
        </span>
      </span>
      <span className="relative z-10 rounded-full border border-white/10 bg-white/[0.055] px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-white/55">
        Status
      </span>
    </div>
  );
}

function MobileNav({
  activeTab,
  setActiveTab
}: {
  activeTab: MobileTab;
  setActiveTab: (tab: MobileTab) => void;
}) {
  return (
    <nav className="glass-nav fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-2 right-2 z-50 rounded-[22px] p-1 lg:hidden sm:left-3 sm:right-3 sm:rounded-[30px] sm:p-1.5">
      <div className="relative z-10 grid grid-cols-4 gap-1">
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;

          return (
            <button
              aria-pressed={active}
              key={tab.id}
              className={cx(
                "grid min-h-12 place-items-center rounded-[18px] px-1 text-[0.64rem] font-semibold transition sm:min-h-14 sm:rounded-[24px] sm:px-1.5 sm:text-[0.68rem]",
                active ? "glass-button-active" : "text-white/50 hover:bg-white/[0.065]"
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="h-[18px] w-[18px] sm:mb-0.5 sm:h-5 sm:w-5" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
