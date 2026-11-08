"use client";

import { useEffect, useRef, type RefObject } from "react";
import { createRacingTrack, createRacingPitLane, RACING_TRACK_POINTS } from "./racing-track";
import type { Race } from "./racing-warmup";

type Props = { raceRef: RefObject<Race> };

const mapX = (x: number) => 100 + x * 1.65;
const mapY = (z: number) => 100 + z * 1.08;
const mapTrack = createRacingTrack();
const sampledTrack = Array.from({ length: 120 }, (_, index) => {
  const point = mapTrack.getPointAt(index / 120);
  return `${mapX(point.x).toFixed(1)},${mapY(point.z).toFixed(1)}`;
});
const trackPath = [...sampledTrack, sampledTrack[0]].join(" ");
const mapPitLane = createRacingPitLane(mapTrack);
const pitMapPoints = Array.from({ length: 61 }, (_, index) => {
  const point = mapPitLane.getPointAt(index / 60);
  return `${mapX(point.x).toFixed(1)},${mapY(point.z).toFixed(1)}`;
});
const pitLanePath = pitMapPoints.join(" ");
const pitEntryPoint = mapPitLane.getPointAt(0);
const pitExitPoint = mapPitLane.getPointAt(1);
const pitBoxPoint = mapPitLane.getPointAt(.52);

export default function RacingTrackMap({ raceRef }: Props) {
  const playerMarker = useRef<SVGCircleElement>(null);
  const rivalMarker = useRef<SVGCircleElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const race = raceRef.current;
      const player = playerMarker.current;
      const rival = rivalMarker.current;
      if (player) {
        player.setAttribute("cx", mapX(race.worldX).toFixed(1));
        player.setAttribute("cy", mapY(race.worldZ).toFixed(1));
      }
      // Kago is only a visible opponent from the scored race (lap 3 onward).
      // Keep the map marker tied to his actual world-space simulation, never
      // to spline progress or an estimated position.
      if (rival) {
        const rivalVisible = race.botRaceEnabled && !race.botPitting && race.lap >= 3 && race.botInitialized;
        rival.setAttribute("visibility", rivalVisible ? "visible" : "hidden");
        if (rivalVisible) {
          rival.setAttribute("cx", mapX(race.botWorldX).toFixed(1));
          rival.setAttribute("cy", mapY(race.botWorldZ).toFixed(1));
        }
      }
      frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [raceRef]);

  return (
    <aside className="racing-track-map" aria-label="Live circuit map showing your car and Kago during the race">
      <div className="racing-track-map-heading">CIRCUIT MAP</div>
      <svg viewBox="0 0 200 200" role="img" aria-label="Track layout, pit lane, player and rival positions">
        <polyline points={trackPath} className="racing-track-map-road-edge" />
        <polyline points={trackPath} className="racing-track-map-road" />
        <polyline points={trackPath} className="racing-track-map-road-centre" />
        <polyline points={pitLanePath} className="racing-track-map-pit" />
        <circle cx={mapX(pitEntryPoint.x)} cy={mapY(pitEntryPoint.z)} r="5" className="racing-track-map-pit-entry" />
        <circle cx={mapX(pitExitPoint.x)} cy={mapY(pitExitPoint.z)} r="4" className="racing-track-map-pit-exit" />
        <rect x={mapX(pitBoxPoint.x)-3.5} y={mapY(pitBoxPoint.z)-3.5} width="7" height="7" rx="1" className="racing-track-map-pit-box" />
        <text x={mapX(pitEntryPoint.x)+7} y={mapY(pitEntryPoint.z)-5} className="racing-track-map-pit-label">PIT IN</text>
        <text x={mapX(pitExitPoint.x)+6} y={mapY(pitExitPoint.z)+9} className="racing-track-map-pit-label">OUT</text>
        <circle cx={mapX(RACING_TRACK_POINTS[0][0])} cy={mapY(RACING_TRACK_POINTS[0][2])} r="3" className="racing-track-map-start" />
        <circle ref={playerMarker} cx={mapX(0)} cy={mapY(72)} r="6" className="racing-track-map-player" />
        <circle ref={rivalMarker} cx={mapX(0)} cy={mapY(72)} r="6" className="racing-track-map-rival" visibility="hidden" />
      </svg>
      <div className="racing-track-map-legend">
        <span><i className="player-dot" />YOU</span>
        <span><i className="rival-dot" />KAGO</span>
      </div>
    </aside>
  );
}
