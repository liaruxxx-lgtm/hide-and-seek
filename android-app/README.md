# SEEKR Android

Eigenständiges Android-Studio-Projekt für die SEEKR-Web-App.

## Öffnen

1. Android Studio öffnen.
2. Den Ordner `android-app` als Projekt auswählen.
3. Das Modul `app` auf einem Emulator oder Android-Gerät starten.

Die App verwendet standardmäßig:

```text
http://127.0.0.1:3000
```

Vor dem Start wird Port 3000 per ADB an den Computer weitergeleitet:

```bash
adb reverse tcp:3000 tcp:3000
```

Die localhost-Verbindung ist wichtig, weil WebView GPS-Zugriff auf unsicheren
LAN-HTTP-Adressen blockiert. Für eine verteilte App muss der Server HTTPS
verwenden.

## Server

Für die Android-App den Produktionsserver verwenden:

```bash
npm run build
npm run start:realtime
```

Der Server läuft auf Port `3000`. `npm run dev:realtime` ist nur für die
Web-Entwicklung gedacht; dessen Fast Refresh kann Android WebView unnötig neu
rendern.

## Echtes Gerät

Mit USB-Debugging wird derselbe Befehl verwendet:

```bash
adb reverse tcp:3000 tcp:3000
```

Wenn die Verbindung zunächst fehlschlägt, erscheint in der App eine
Servermaske. Dort `http://127.0.0.1:3000` eintragen. Eine LAN-IP funktioniert
für die Oberfläche, aber Browser-APIs wie GPS benötigen HTTPS.

## APK bauen

```bash
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
```

Die APK liegt anschließend unter:

```text
app/build/outputs/apk/debug/app-debug.apk
```

Für eine veröffentlichte Version sollte der Server über HTTPS erreichbar sein
und Klartext-HTTP in Manifest und Network Security Config deaktiviert werden.
