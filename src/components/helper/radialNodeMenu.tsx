import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import "./radialNodeMenu.css";

export interface RadialMenuNode {
  /** Stable identity for the React key and test lookups. */
  key: string;
  icon: React.ReactNode;
  label: string;
  /** Present -> rendered as a picker with a highlighted ring when true
   *  (role menuitemradio by default, or menuitemcheckbox if `toggle` is
   *  set). Omitted -> a plain menuitem action with no ring. */
  active?: boolean;
  /** True for an independent on/off toggle - several nodes in the same
   *  menu can be active at once (menuitemcheckbox), unlike the default
   *  mutually-exclusive picker (menuitemradio, e.g. exhaust's particle/
   *  cloud/voxel styles, where only one is ever active). */
  toggle?: boolean;
  /** Ring color when active: "accent" (default, yellow) for a picker
   *  option, or "danger"/"success" for a toggle's off/on state. */
  activeTone?: "accent" | "danger" | "success";
  onSelect: () => void;
}

export interface RadialNodeMenuProps {
  /** Icon/content shown in the always-visible central trigger button. */
  trigger: React.ReactNode;
  /** Accessible name for the trigger button. */
  triggerLabel: string;
  /** The sub-options themselves, fanned out in an arc below the trigger. */
  nodes: RadialMenuNode[];
  className?: string;
}

/* eslint-disable react/prop-types -- TS interfaces already cover this */

const FAN_RADIUS = 58;
// Chord length between adjacent nodes is 2 * FAN_RADIUS * sin(gap/2) - at
// the previous 34deg/54px this worked out to ~1.6px of actual edge-to-edge
// gap between 30px buttons, i.e. nearly touching. 42deg/58px gives ~12px.
const DEGREES_PER_GAP = 42;
const MAX_SWEEP_DEGREES = 150;
const EDGE_MARGIN = 8;

/** Angle (degrees, 0 = straight down, negative = left) each node sits at,
 *  evenly spread so the whole set reads as one arc rather than a stack. */
const fanAngle = (index: number, count: number) => {
  if (count <= 1) return 0;
  const sweep = Math.min(MAX_SWEEP_DEGREES, DEGREES_PER_GAP * (count - 1));
  return -sweep / 2 + index * (sweep / (count - 1));
};

const fanOffset = (index: number, count: number) => {
  const radians = (fanAngle(index, count) * Math.PI) / 180;
  return {
    dx: FAN_RADIUS * Math.sin(radians),
    dy: FAN_RADIUS * Math.cos(radians),
  };
};

const renderNode = (node: RadialMenuNode, extraClassName: string) => {
  const isPicker = node.active !== undefined;
  const toneClass =
    node.active && node.activeTone && node.activeTone !== "accent"
      ? ` ${extraClassName}--tone-${node.activeTone}`
      : "";
  return (
    <button
      key={node.key}
      type="button"
      className={`hud-icon-button ${extraClassName}${
        node.active ? ` ${extraClassName}--active` : ""
      }${toneClass}`}
      role={
        isPicker
          ? node.toggle
            ? "menuitemcheckbox"
            : "menuitemradio"
          : "menuitem"
      }
      aria-checked={isPicker ? node.active : undefined}
      onClick={() => node.onSelect()}
      aria-label={node.label}
      title={node.label}
    >
      {node.icon}
    </button>
  );
};

/**
 * Reusable "speed dial" trigger: a primary icon button that, on hover
 * (desktop) or tap (any device), fans its sub-options out in an arc below
 * it - the options themselves are the arc, not a separate dropdown. Meant
 * for any HUD button that needs to offer a small set of sub-options -
 * exhaust style is the first caller; mute/volume can adopt it the same way
 * once it grows sub-options.
 *
 * State is driven in JS rather than CSS :hover so the open/closed state is
 * a plain render output, which is what makes this testable without a real
 * browser. An invisible "hover bridge" (see .radial-node-menu__hover-bridge
 * in the CSS) covers the physical gap the mouse sweeps through between the
 * trigger and a fanned-out node - without it, that gap is bare page/canvas,
 * not part of this component's DOM subtree, so crossing it would fire
 * the pointer-leave handler and collapse the branch before the cursor ever
 * reaches the node it's headed for.
 */
const RadialNodeMenu: React.FC<RadialNodeMenuProps> = ({
  trigger,
  triggerLabel,
  nodes,
  className = "",
}) => {
  const [expanded, setExpanded] = useState(false);
  const [shiftX, setShiftX] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const fanRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setExpanded(false), []);
  const open = useCallback(() => setExpanded(true), []);

  // Hover-to-open is a mouse-only affordance - gated on pointerType rather
  // than using onMouseEnter/onMouseLeave directly, because touch taps also
  // fire the legacy mouseover/mouseout compatibility events those synthesize
  // from (so React's derived mouseenter/mouseleave fire for touch too, not
  // just real hover). Letting a tap's synthesized mouseenter call open()
  // races the same tap's click: open() from the compat mouseenter flips
  // expanded true, then the trigger's onClick immediately toggles it back
  // to false (see its blind `!current` below) - the tap appears to do
  // nothing, and it takes a second tap to actually land the branch open.
  // Real pointerenter/pointerleave carry an accurate pointerType (native
  // browser behavior, not something touch spoofs), so checking it here
  // restricts hover-to-open to non-touch input, leaving touch to open
  // exclusively through that same onClick toggle - the one path
  // HelpButton (no hover state at all) already uses single-tap.
  //
  // Excludes "touch"/"pen" rather than requiring exactly "mouse", so an
  // environment that leaves pointerType unset still behaves like a mouse
  // (the permissive direction to fail toward - jsdom's fireEvent can't
  // actually populate pointerType on a dispatched PointerEvent, so
  // radialNodeMenu.test.tsx's hover coverage depends on this default).
  const handlePointerEnter = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") open();
    },
    [open],
  );
  const handlePointerLeave = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") close();
    },
    [close],
  );

  // Tap/click outside while expanded folds the branch back in - the only
  // way touch devices (no hover-away) can dismiss it.
  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        close();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [expanded, close]);

  // Re-measure every time the branch opens: if the fanned-out nodes would
  // clip past the viewport edge, shift the whole fan horizontally (rather
  // than recomputing each node's angle) to bring it back on-screen.
  //
  // This deliberately does NOT call getBoundingClientRect on the fan nodes
  // themselves: they're mid CSS-transition at this exact point (the class
  // that starts the pop-out animation was just applied this same commit),
  // so measuring them here reads their still-collapsed starting geometry,
  // not where they're headed - which under-detects clipping and never
  // corrects for it once the animation actually gets there. Instead this
  // computes each node's target position arithmetically from the trigger's
  // own (non-animating) rect plus the same fanOffset() math used to derive
  // --fan-x/--fan-y, which is accurate regardless of transition timing.
  useLayoutEffect(() => {
    if (!expanded) {
      setShiftX(0);
      return;
    }
    const root = rootRef.current;
    const count = nodes.length;
    if (!root || count === 0) return;
    const rootRect = root.getBoundingClientRect();
    const centerX = rootRect.left + rootRect.width / 2;
    const halfNodeSize = rootRect.width / 2;
    let minLeft = Infinity;
    let maxRight = -Infinity;
    for (let index = 0; index < count; index += 1) {
      const { dx } = fanOffset(index, count);
      minLeft = Math.min(minLeft, centerX + dx - halfNodeSize);
      maxRight = Math.max(maxRight, centerX + dx + halfNodeSize);
    }
    if (maxRight > window.innerWidth - EDGE_MARGIN) {
      setShiftX(window.innerWidth - EDGE_MARGIN - maxRight);
    } else if (minLeft < EDGE_MARGIN) {
      setShiftX(EDGE_MARGIN - minLeft);
    } else {
      setShiftX(0);
    }
  }, [expanded, nodes.length]);

  const selectNode = (node: RadialMenuNode) => {
    node.onSelect();
    close();
    // A clicked/tapped button keeps DOM focus afterward, which would hold
    // the branch open via :focus-within even though we just asked it to
    // close - drop focus so the collapse actually happens.
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <div
      ref={rootRef}
      className={`radial-node-menu${expanded ? " radial-node-menu--expanded" : ""}${
        className ? ` ${className}` : ""
      }`}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <div className="radial-node-menu__hover-bridge" aria-hidden="true" />

      <button
        className="hud-icon-button"
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-haspopup="true"
        aria-expanded={expanded}
        aria-label={triggerLabel}
        title={triggerLabel}
      >
        {trigger}
      </button>

      <div
        ref={fanRef}
        className="radial-node-menu__fan"
        role="menu"
        aria-hidden={!expanded}
      >
        {nodes.map((node, index) => {
          const { dx, dy } = fanOffset(index, nodes.length);
          return (
            <div
              key={node.key}
              className={`radial-node-menu__fan-item${
                expanded ? " radial-node-menu__fan-item--expanded" : ""
              }`}
              style={
                {
                  "--fan-x": `${dx + shiftX}px`,
                  "--fan-y": `${dy}px`,
                  transitionDelay: `${Math.min(index, 4) * 0.03}s`,
                } as React.CSSProperties
              }
            >
              {renderNode(
                { ...node, onSelect: () => selectNode(node) },
                "radial-node-menu__fan-node",
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RadialNodeMenu;
