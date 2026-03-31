"use client";

import { useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

export default function ParticlesBackground() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <Particles
      id="tsparticles"
      className="absolute inset-0 z-0"
      options={{
        fpsLimit: 60,
        smooth: true,
        particles: {
          number: { value: 60, density: { enable: true, width: 800, height: 800 } },
          color: { value: "#f414e8" },
          shape: { type: "circle" },
          opacity: { value: 0.45 },
          size: { value: { min: 1, max: 2.5 } },
          links: {
            enable: true,
            distance: 120,
            color: "#ffffff",
            opacity: 0.3,
            width: 1,
          },
          move: {
            enable: true,
            speed: 1.8,
            direction: "none",
            outModes: { default: "out" },
          },
        },
        interactivity: {
          events: {
            onHover: { enable: false },
            onClick: { enable: false },
          },
        },
        detectRetina: false,
      }}
    />
  );
}
