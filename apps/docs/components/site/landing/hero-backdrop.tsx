import Image from "next/image";
import heroImage from "../../../public/hero-bg.png";

/**
 * <HeroBackdrop> — photographic background for the landing hero (public/hero-bg.png).
 * The photo drifts in a slow Ken Burns zoom (frozen under prefers-reduced-motion via globals.css),
 * sits under a dark scrim so the light hero copy stays legible, and its bottom edge is masked out
 * so it dissolves into whichever page canvas (light or dark) sits behind it. Purely decorative.
 */
export function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-[min(100%,900px)] overflow-hidden [mask-image:linear-gradient(to_bottom,black_62%,transparent)] md:h-[calc(100%-260px)] md:[mask-image:linear-gradient(to_bottom,black_72%,transparent)]"
    >
      <div className="absolute inset-0 animate-ken-burns">
        <Image
          src={heroImage}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="object-cover object-[50%_40%]"
        />
      </div>
      {/* Scrim: darker at the top (navbar) and behind the headline, lighter where the scene shows through. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,12,16,0.72)_0%,rgba(5,12,16,0.48)_38%,rgba(5,12,16,0.58)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_48%_at_50%_38%,rgba(5,12,16,0.5),transparent)]" />
    </div>
  );
}
