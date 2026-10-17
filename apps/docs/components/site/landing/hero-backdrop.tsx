import Image from "next/image";
import heroImage from "../../../public/hero-bg.png";

/**
 * <HeroBackdrop> — cinematic photographic background for the landing hero.
 * Renders the glowing portal and pine forest with atmospheric god rays,
 * layered with subtle contrast gradients for the headline and navbar,
 * smoothly dissolving into the page canvas at the bottom.
 */
export function HeroBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 h-[680px] sm:h-[720px] lg:h-[760px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)] ${className || ""}`}
    >
      <div className="absolute inset-0 animate-ken-burns">
        <Image
          src={heroImage}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="object-cover object-[50%_35%]"
        />
      </div>

      {/* Top navbar scrim */}
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-[#05070a]/90 via-[#05070a]/45 to-transparent" />

      {/* Left-side text readability scrim */}
      <div className="absolute inset-y-0 left-0 w-full lg:w-[62%] bg-gradient-to-r from-[#05070a]/95 via-[#05070a]/70 to-transparent" />

      {/* Ambient dark vignette surrounding the portal */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_40%,transparent_45%,rgba(5,7,10,0.65)_100%)]" />

      {/* Bottom dissolve into canvas */}
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-canvas via-canvas/70 to-transparent" />
    </div>
  );
}
