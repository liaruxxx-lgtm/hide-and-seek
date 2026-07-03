"use client";

import type {
  LayerGroup,
  Map as LeafletMap,
  Marker as LeafletMarker
} from "leaflet";
import { useEffect, useRef } from "react";
import type { Player } from "@/app/lib/game-data";

type LivePosition = {
  accuracy: number;
  latitude: number;
  longitude: number;
};

type LiveMapLayerProps = {
  position: LivePosition | null;
  roster: Player[];
};

const FALLBACK_CENTER: [number, number] = [52.52, 13.405];

export function LiveMapLayer({ position, roster }: LiveMapLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const locationMarkerRef = useRef<LeafletMarker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const latestDataRef = useRef({ position, roster });

  latestDataRef.current = { position, roster };

  useEffect(() => {
    let disposed = false;

    import("leaflet").then((leaflet) => {
      if (disposed || !containerRef.current || mapRef.current) return;

      const initialCenter = getCenter(latestDataRef.current);
      const map = leaflet.map(containerRef.current, {
        attributionControl: true,
        preferCanvas: true,
        zoomControl: false
      });

      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          keepBuffer: 1,
          maxZoom: 19,
          updateInterval: 350,
          updateWhenIdle: true,
          updateWhenZooming: false
        })
        .addTo(map);

      const markerLayer = leaflet.layerGroup().addTo(map);
      leafletRef.current = leaflet;
      mapRef.current = map;
      markerLayerRef.current = markerLayer;
      map.setView(initialCenter, 17, { animate: false });
      drawMarkers(leaflet, map, markerLayer, locationMarkerRef, latestDataRef.current);

      window.requestAnimationFrame(() => map.invalidateSize(false));
    });

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      locationMarkerRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!leaflet || !map || !markerLayer) return;

    drawMarkers(leaflet, map, markerLayer, locationMarkerRef, { position, roster });
  }, [position, roster]);

  return <div ref={containerRef} className="seekr-live-map absolute inset-0 z-0" />;
}

function getCenter({
  position,
  roster
}: {
  position: LivePosition | null;
  roster: Player[];
}): [number, number] {
  if (position) return [position.latitude, position.longitude];

  const player = roster.find(
    (candidate) =>
      typeof candidate.latitude === "number" && typeof candidate.longitude === "number"
  );
  return player ? [player.latitude!, player.longitude!] : FALLBACK_CENTER;
}

function drawMarkers(
  leaflet: typeof import("leaflet"),
  map: LeafletMap,
  markerLayer: LayerGroup,
  locationMarkerRef: React.MutableRefObject<LeafletMarker | null>,
  data: { position: LivePosition | null; roster: Player[] }
) {
  markerLayer.clearLayers();
  locationMarkerRef.current = null;

  const geoPlayers = data.roster.filter(
    (player) => typeof player.latitude === "number" && typeof player.longitude === "number"
  );

  for (const player of geoPlayers) {
    const markerElement = document.createElement("div");
    markerElement.className = "seekr-live-marker";
    markerElement.textContent = player.avatar;
    markerElement.style.setProperty("--marker-color", player.color);

    leaflet
      .marker([player.latitude!, player.longitude!], {
        icon: leaflet.divIcon({
          className: "seekr-live-marker-shell",
          html: markerElement,
          iconAnchor: [20, 20],
          iconSize: [40, 40]
        }),
        title: player.name
      })
      .bindTooltip(player.name, { direction: "top", offset: [0, -18] })
      .addTo(markerLayer);
  }

  if (data.position) {
    const currentLatLng: [number, number] = [
      data.position.latitude,
      data.position.longitude
    ];
    const alreadyRepresented = geoPlayers.some(
      (player) =>
        Math.abs(player.latitude! - data.position!.latitude) < 0.000001 &&
        Math.abs(player.longitude! - data.position!.longitude) < 0.000001
    );

    leaflet
      .circle(currentLatLng, {
        className: "seekr-accuracy-circle",
        color: "#f7f9fb",
        fillColor: "#d8f6ff",
        fillOpacity: 0.08,
        radius: Math.max(2, data.position.accuracy),
        weight: 1
      })
      .addTo(markerLayer);

    if (!alreadyRepresented) {
      const locationElement = document.createElement("div");
      locationElement.className = "seekr-current-location";
      const marker = leaflet
        .marker(currentLatLng, {
          icon: leaflet.divIcon({
            className: "seekr-live-marker-shell",
            html: locationElement,
            iconAnchor: [12, 12],
            iconSize: [24, 24]
          }),
          title: "Deine Position"
        })
        .addTo(markerLayer);
      locationMarkerRef.current = marker;
    }

    if (!map.getBounds().pad(-0.2).contains(currentLatLng)) {
      map.panTo(currentLatLng, { animate: false });
    }
  }
}
