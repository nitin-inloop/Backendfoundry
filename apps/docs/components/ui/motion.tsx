"use client";
/**
 * Reusable client animation helpers built on `motion/react`.
 *
 * Progressive by design: server HTML renders content fully visible. After hydration, elements that are
 * still below the fold are hidden instantly and revealed when scrolled into view. Elements already on
 * screen at mount are left alone (no flash). Under prefers-reduced-motion nothing is hidden or moved.
 * For above-the-fold page-load motion use the CSS class `bf-rise` (+ `[animation-delay:..]`) instead.
 *
 *   <FadeIn>        fades + rises when scrolled into view (once).
 *                   Props: delay?: number (seconds, default 0), y?: number (default 16),
 *                   duration?: number (default 0.6), amount?: number (0..1 visible before triggering, default 0.2),
 *                   as?: "div" | "section" | "li" | "span" | "article" | "ul", className?, children
 *   <Stagger>       container that reveals its <StaggerItem> children one after another in view.
 *                   Props: stagger?: number (default 0.06), delay?: number, amount?, as?, className?, children
 *   <StaggerItem>   child of <Stagger>. Props: as?, className?, children, y?: number (default 14)
 */
import { motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

type Tag = "div" | "section" | "li" | "span" | "article" | "ul";

const tags = {
  div: motion.div,
  section: motion.section,
  li: motion.li,
  span: motion.span,
  article: motion.article,
  ul: motion.ul
} as const;

type RevealState = "show" | "hidden";

/** Returns "hidden" only for elements that start below the fold after mount, then "show" once in view. */
function useReveal(amount: number) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [armed, setArmed] = useState(false);
  const inView = useInView(ref, { once: true, amount });

  useEffect(() => {
    if (reduce || !ref.current) return;
    const top = ref.current.getBoundingClientRect().top;
    if (top > window.innerHeight * 0.92) setArmed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const state: RevealState = armed && !inView ? "hidden" : "show";
  return { ref, state, animated: armed };
}

export interface FadeInProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  amount?: number;
  as?: Tag;
  className?: string;
}

export function FadeIn({ children, delay = 0, y = 16, duration = 0.6, amount = 0.2, as = "div", className }: FadeInProps) {
  const { ref, state, animated } = useReveal(amount);
  const Comp = tags[as] as typeof motion.div;
  const variants: Variants = {
    hidden: { opacity: 0, y, transition: { duration: 0 } },
    show: { opacity: 1, y: 0, transition: animated ? { duration, delay, ease: EASE } : { duration: 0 } }
  };
  return (
    <Comp ref={ref as Ref<HTMLDivElement>} className={className} variants={variants} initial={false} animate={state}>
      {children}
    </Comp>
  );
}

export interface StaggerProps {
  children: ReactNode;
  stagger?: number;
  delay?: number;
  amount?: number;
  as?: Tag;
  className?: string;
}

export function Stagger({ children, stagger = 0.06, delay = 0, amount = 0.15, as = "div", className }: StaggerProps) {
  const { ref, state, animated } = useReveal(amount);
  const Comp = tags[as] as typeof motion.div;
  const variants: Variants = {
    hidden: {},
    show: { transition: animated ? { staggerChildren: stagger, delayChildren: delay } : {} }
  };
  return (
    <Comp ref={ref as Ref<HTMLDivElement>} className={className} variants={variants} initial={false} animate={state}>
      {children}
    </Comp>
  );
}

export interface StaggerItemProps {
  children: ReactNode;
  as?: Tag;
  y?: number;
  className?: string;
}

export function StaggerItem({ children, as = "div", y = 14, className }: StaggerItemProps) {
  const Comp = tags[as] as typeof motion.div;
  const variants: Variants = {
    hidden: { opacity: 0, y, transition: { duration: 0 } },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } }
  };
  return (
    <Comp className={className} variants={variants}>
      {children}
    </Comp>
  );
}
