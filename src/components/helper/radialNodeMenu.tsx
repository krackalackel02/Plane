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
  /** Present -> rendered as a menuitemradio (a mutually-exclusive picker
   *  like exhaust style). Omitted -> a plain menuitem action. */
  active?: boolean;
  onSelect: () => void;
}

export interface RadialNodeMenuProps {
  /** Icon/content shown in the always-visible central trigger button. */
  trigger: React.ReactNode;
  /** Accessible name for the trigger button. */
  triggerLabel: string;
  /** Full stacked list dropped in the connected vertical panel beneath the trigger. */
  nodes: RadialMenuNode[];
  /** Optional quick-access nodes that pop out left/right of the trigger,
   *  inline on the same bar axis. Capped at 2 (one per side) - more would
   *  need a real arc layout, which no current caller needs. */
  arcNodes?: RadialMenuNode[];
  className?: string;
}

/* eslint-disable react/prop-types -- TS interfaces already cover this */

type Align = "center" | "left" | "right";

const EDGE_MARGIN = 8;

const renderNode = (node: RadialMenuNode, extraClassName: string) => {
  const isPicker = node.active !== undefined;
  return (
    <button
      key={node.key}
      type="button"
      className={`hud-icon-button ${extraClassName}${
        node.active ? ` ${extraClassName}--active` : ""
      }`}
      role={isPicker ? "menuitemradio" : "menuitem"}
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
 * Reusable "speed dial" trigger: a primary icon button that, on
 * hover (desktop) or tap (any device), branches into a connected vertical
 * list of sub-actions plus (optionally) one or two nodes that pop out
 * inline to the left/right of the trigger. Meant for any HUD button that
 * needs to offer a small set of sub-options without a full dropdown -
 * exhaust style is the first caller; mute/volume can adopt it the same way
 * once it grows sub-options.
 *
 * State is driven in JS rather than CSS :hover so the open/closed/aligned
 * state is a plain render output, which is what makes this testable
 * without a real browser.
 */
const RadialNodeMenu: React.FC<RadialNodeMenuProps> = ({
  trigger,
  triggerLabel,
  nodes,
  arcNodes = [],
  className = "",
}) => {
  const [expanded, setExpanded] = useState(false);
  const [align, setAlign] = useState<Align>("center");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setExpanded(false), []);
  const open = useCallback(() => setExpanded(true), []);

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

  // Re-measure every time the branch opens: decide whether the centered
  // vertical panel would clip past the viewport edge, and if so anchor it
  // to whichever side of the trigger keeps it fully on-screen instead.
  useLayoutEffect(() => {
    if (!expanded) {
      setAlign("center");
      return;
    }
    const panel = listRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    if (rect.right > window.innerWidth - EDGE_MARGIN) {
      setAlign("right");
    } else if (rect.left < EDGE_MARGIN) {
      setAlign("left");
    } else {
      setAlign("center");
    }
  }, [expanded]);

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
      className={`radial-node-menu radial-node-menu--align-${align}${
        arcNodes.length > 0 ? " radial-node-menu--has-arc" : ""
      }${expanded ? " radial-node-menu--expanded" : ""}${
        className ? ` ${className}` : ""
      }`}
      onMouseEnter={open}
      onMouseLeave={close}
    >
      {arcNodes.slice(0, 2).map((node, index) => (
        <div
          key={node.key}
          className={`radial-node-menu__arc radial-node-menu__arc--${
            index === 0 ? "left" : "right"
          }`}
        >
          {renderNode(
            { ...node, onSelect: () => selectNode(node) },
            "radial-node-menu__arc-node",
          )}
        </div>
      ))}

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
        ref={listRef}
        className="radial-node-menu__list"
        role="menu"
        aria-hidden={!expanded}
      >
        {nodes.map((node, index) => (
          <div
            key={node.key}
            className="radial-node-menu__list-item"
            style={{ transitionDelay: `${Math.min(index, 4) * 0.04}s` }}
          >
            {renderNode(
              { ...node, onSelect: () => selectNode(node) },
              "radial-node-menu__list-node",
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RadialNodeMenu;
