import React, { useEffect, useState } from 'react';
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

const CyberBackground = () => {
    const [init, setInit] = useState(false);

    useEffect(() => {
        initParticlesEngine(async (engine) => {
            await loadSlim(engine);
        }).then(() => {
            setInit(true);
        });
    }, []);

    return (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            {/* The CRT Scanline Overlay */}
            <div className="scanline"></div>

            {/* The moving 3D perspective grid floor */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden pointer-events-none opacity-20 hidden md:block">
               <div className="absolute perspective-grid animate-grid-move"></div>
            </div>

            {init && (
               <Particles
                   id="tsparticles"
                   className="absolute inset-0 z-0 opacity-40 mix-blend-screen"
                   options={{
                       background: {
                           color: {
                               value: "transparent",
                           },
                       },
                       fpsLimit: 60,
                       particles: {
                           color: {
                               value: ["#00f5ff", "#9d00ff"],
                           },
                           links: {
                               color: "#00f5ff",
                               distance: 150,
                               enable: true,
                               opacity: 0.1,
                               width: 1,
                           },
                           move: {
                               direction: "none",
                               enable: true,
                               outModes: {
                                   default: "bounce",
                               },
                               random: true,
                               speed: 0.5,
                               straight: false,
                           },
                           number: {
                               density: {
                                   enable: true,
                                   area: 800,
                               },
                               value: 40,
                           },
                           opacity: {
                               value: { min: 0.1, max: 0.5 },
                               animation: {
                                   enable: true,
                                   speed: 0.5,
                                   minimumValue: 0.1
                               }
                           },
                           shape: {
                               type: "circle",
                           },
                           size: {
                               value: { min: 1, max: 3 },
                           },
                       },
                       detectRetina: true,
                   }}
               />
            )}
            {/* Vignette/Shadow overlay to center the attention */}
            <div className="absolute inset-0 bg-gradient-to-t from-cyberDark via-transparent to-cyberDark z-10 opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-r from-cyberBase via-transparent to-cyberBase z-10 opacity-70" />
        </div>
    );
};

export default CyberBackground;
