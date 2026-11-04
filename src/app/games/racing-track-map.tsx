"use client";

import { useEffect, useRef } from "react";
import { RACING_TRACK_POINTS } from "./racing-track";
import type { Race } from "./racing-warmup";

type Props = { raceRef: React.RefObject<Race> };

const mapX = (x: number) => 100 + x * 1.65;
const mapY = (z: number) => 100 + z * 1.08;
const trackPath = RACING_TRACK_POINTS
  .map(([x, , z]) => `${mapX(x).toFixed(1)},${mapY(z).toFixed(1)}`)
  .join(" ");

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
      if (rival) {
        const rivalX = race.botInitialized ? race.botWorldX : 3;
        const rivalZ = race.botInitialized ? race.botWorldZ : 70;
        rival.setAttribute("cx", mapX(rivalX).toFixed(1));
        rival.setAttribute("cy", mapY(rivalZ).toFixed(1));
      }
      frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [raceRef]);

  return (
    <aside className="racing-track-map" aria-label="Live circuit map showing your car and Kago">
      <div className="racing-track-map-heading">CIRCUIT MAP</div>
      <svg viewBox="0 0 200 200" role="img" aria-label="Track layout with live player and Kago positions">
        <polyline points={trackPath} className="racing-track-map-road-edge" />
        <polyline points={trackPath} className="racing-track-map-road" />
        <polyline points={trackPath} className="racing-track-map-road-centre" />
        <circle cx={mapX(RACING_TRACK_POINTS[0][0])} cy={mapY(RACING_TRACK_POINTS[0][2])} r="3" className="racing-track-map-start" />
        <circle ref={playerMarker} cx={mapX(0)} cy={mapY(72)} r="6" className="racing-track-map-player" />
        <circle ref={rivalMarker} cx={mapX(3)} cy={mapY(70)} r="6" className="racing-track-map-rival" />
      </svg>
      <div className="racing-track-map-legend">
        <span><i className="player-dot" />YOU</span>
        <span><i className="rival-dot" />KAGO</span>
      </div>
    </aside>
  );
}
