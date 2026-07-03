import {
  Bell,
  Camera,
  CircleDot,
  Crosshair,
  Eye,
  Flag,
  Ghost,
  History,
  MapPin,
  MessageCircle,
  Mic2,
  Radar,
  RadioTower,
  Shield,
  Sparkles,
  Timer,
  Trophy,
  Users,
  Zap
} from "lucide-react";

export type PlayerRole = "Sucher" | "Verstecker" | "Zuschauer";
export type PlayerStatus = "live" | "hidden" | "revealed" | "caught";

export type Player = {
  id: string;
  name: string;
  handle: string;
  role: PlayerRole;
  team: "Astra" | "Nova" | "Host";
  isHost?: boolean;
  avatar: string;
  color: string;
  x: number;
  y: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  ready: boolean;
  status: PlayerStatus;
  battery: number;
  signal: number;
  xp: number;
  trail: Array<[number, number]>;
  perks: string[];
};

export const players: Player[] = [];

export const gameModes = [
  {
    name: "Klassisch",
    detail: "Verzögerte Standort-Enthüllungen und präziser Fangradius",
    revealMin: 30,
    revealMax: 60,
    icon: Crosshair
  },
  {
    name: "Infektion",
    detail: "Gefangene Verstecker wechseln elegant ins Sucherteam",
    revealMin: 24,
    revealMax: 45,
    icon: Zap
  },
  {
    name: "Letzter Überlebender",
    detail: "Schrumpfende Zonen und ein ruhiger finaler Ortungsimpuls",
    revealMin: 35,
    revealMax: 65,
    icon: Trophy
  },
  {
    name: "Teammodus",
    detail: "Geteilte Hinweise, Team-Pings und taktische Rettungen",
    revealMin: 28,
    revealMax: 50,
    icon: Users
  },
  {
    name: "Zeitjagd",
    detail: "Kurze Runden mit zunehmend dichterem Scan-Takt",
    revealMin: 12,
    revealMax: 24,
    icon: Timer
  },
  {
    name: "Ohne Karte",
    detail: "Keine Karte, nur Richtungs- und Näherungshinweise",
    revealMin: 20,
    revealMax: 40,
    icon: Eye
  },
  {
    name: "Freizeitpark",
    detail: "Attraktionen, Warteschlangen, Checkpoints und sichere Fahrbereiche",
    revealMin: 30,
    revealMax: 60,
    icon: Flag
  },
  {
    name: "Studio-Herausforderung",
    detail: "Zuschauerkamera, Wiedergabe-Regie und teilbare Kurzvideos",
    revealMin: 18,
    revealMax: 36,
    icon: Camera
  }
];

export const zones = [
  {
    name: "Sichere Fahrzone",
    type: "safe",
    x: 16,
    y: 18,
    w: 24,
    h: 19
  },
  {
    name: "Gedränge-Drift",
    type: "danger",
    x: 59,
    y: 48,
    w: 28,
    h: 26
  },
  {
    name: "Gesperrter Bereich",
    type: "restricted",
    x: 8,
    y: 67,
    w: 28,
    h: 17
  }
];

export const attractions = [
  { name: "Nordtor", x: 18, y: 25, queue: "06 min", icon: RadioTower },
  { name: "Glasloop", x: 36, y: 76, queue: "14 min", icon: CircleDot },
  { name: "Himmelsdeck", x: 66, y: 55, queue: "21 min", icon: MapPin },
  { name: "Zentralplatz", x: 78, y: 28, queue: "04 min", icon: Flag }
];

export const abilityDeck = [
  {
    name: "Radarscan",
    role: "Sucher",
    cooldown: "0:18",
    icon: Radar,
    detail: "Öffnet einen temporären, weichen Ortungskegel"
  },
  {
    name: "Verdacht markieren",
    role: "Sucher",
    cooldown: "bereit",
    icon: MapPin,
    detail: "Setzt eine gemeinsame Team-Markierung"
  },
  {
    name: "Ködersignal",
    role: "Verstecker",
    cooldown: "1:40",
    icon: Ghost,
    detail: "Projiziert eine falsche Zuletzt-gesehen-Position"
  },
  {
    name: "Spurtarnung",
    role: "Verstecker",
    cooldown: "0:52",
    icon: Shield,
    detail: "Blendet GPS-Spuren bis zur nächsten Enthüllung aus"
  }
];

export const socialSystems = [
  { label: "Sprache", value: "Teamkanal", icon: Mic2 },
  { label: "Mitteilungen", value: "Aktiv", icon: Bell },
  { label: "Reaktionen", value: "12", icon: MessageCircle },
  { label: "Verlauf", value: "48", icon: History },
  { label: "XP", value: "21.100", icon: Sparkles },
  { label: "Meldungen", value: "0", icon: Shield }
];

export const backendSystems = [
  { label: "Echtzeit", value: "Socket.io", state: "live" },
  { label: "Anmeldung", value: "Supabase bereit", state: "sicher" },
  { label: "Region", value: "EU 18 ms", state: "schnell" },
  { label: "Manipulationsschutz", value: "GPS-Varianz", state: "aktiv" },
  { label: "Privatsphäre", value: "Temporäre Standortdaten", state: "privat" },
  { label: "Ereignisse", value: "Täglich live", state: "geplant" }
];

export const creatorTools = [
  "Zuschauen",
  "Wiedergabe",
  "Regie-Kamera",
  "Höhepunkte",
  "Regie-Ereignisse",
  "Hochformat-Clips"
];

export const matchEvents = [
  "Lobby-System bereit",
  "Radarscan kann getestet werden",
  "GPS-Ortung wartet auf Freigabe",
  "Einladungscode kann kopiert werden",
  "Tagesziel: eine echte Lobby mit Freunden starten"
];
