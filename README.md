# SEEKR

SEEKR ist ein mobiler Progressive-Web-App-Prototyp für echte GPS-Versteckspiel-Matches.

## Run

```bash
npm install
npm run dev
```

Öffne `http://localhost:3000`.

For the Socket.io custom server, use this instead of `npm run dev`:

```bash
npm run dev:realtime
```

Set `NEXT_PUBLIC_REALTIME_ENABLED=true` when you want the client to connect to the Socket.io server.

## Optional Environment

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_REALTIME_ENABLED=false
```

Ohne externe Schlüssel läuft SEEKR mit integrierter taktischer Kartensimulation und lokalem Lobby-Zustand.

## Android

Das eigenständige Android-Studio-Projekt liegt unter [`android-app`](./android-app).
Es verbindet sich über `adb reverse` und `http://127.0.0.1:3000` mit dem lokalen
Realtime-Server. Weitere Start-, Geräte- und Build-Hinweise stehen in
[`android-app/README.md`](./android-app/README.md).
