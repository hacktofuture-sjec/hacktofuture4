import { GlowCard } from "@/components/ui/spotlight-card";

export function SpotlightDemo(){
  return(
    <div className="w-screen h-screen flex flex-row items-center justify-center gap-10">
      <GlowCard glowColor="blue">
        <div className="flex flex-col items-center justify-center h-full">
          <h3 className="text-white font-bold text-lg mb-2">Blue Spotlight</h3>
          <p className="text-white/80 text-sm">Interactive glow effect</p>
        </div>
      </GlowCard>
      <GlowCard glowColor="purple">
        <div className="flex flex-col items-center justify-center h-full">
          <h3 className="text-white font-bold text-lg mb-2">Purple Spotlight</h3>
          <p className="text-white/80 text-sm">Mouse tracking enabled</p>
        </div>
      </GlowCard>
      <GlowCard glowColor="green">
        <div className="flex flex-col items-center justify-center h-full">
          <h3 className="text-white font-bold text-lg mb-2">Green Spotlight</h3>
          <p className="text-white/80 text-sm">Dynamic border glow</p>
        </div>
      </GlowCard>
    </div>
  );
};
