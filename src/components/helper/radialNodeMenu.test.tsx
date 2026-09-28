import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import RadialNodeMenu, { RadialMenuNode } from "./radialNodeMenu";

const makeNodes = (onSelect: (key: string) => void): RadialMenuNode[] => [
  {
    key: "a",
    icon: <span>A</span>,
    label: "Option A",
    active: true,
    onSelect: () => onSelect("a"),
  },
  {
    key: "b",
    icon: <span>B</span>,
    label: "Option B",
    active: false,
    onSelect: () => onSelect("b"),
  },
  {
    key: "c",
    icon: <span>C</span>,
    label: "Option C",
    active: false,
    onSelect: () => onSelect("c"),
  },
];

const renderMenu = (extra?: Partial<Parameters<typeof RadialNodeMenu>[0]>) => {
  const onSelect = vi.fn();
  render(
    <RadialNodeMenu
      trigger={<span>Trigger</span>}
      triggerLabel="Open menu"
      nodes={makeNodes(onSelect)}
      {...extra}
    />,
  );
  return { onSelect };
};

describe("RadialNodeMenu", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts collapsed with the fan hidden", () => {
    renderMenu();
    expect(screen.getByLabelText("Open menu")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("menu", { hidden: true })).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("expands on hover (desktop) and collapses on mouse leave", () => {
    renderMenu();
    const trigger = screen.getByLabelText("Open menu");
    const root = trigger.parentElement as HTMLElement;

    fireEvent.mouseEnter(root);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.mouseLeave(root);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("moving from the trigger toward the hover bridge does not collapse the branch", () => {
    renderMenu();
    const trigger = screen.getByLabelText("Open menu");
    const root = trigger.parentElement as HTMLElement;
    fireEvent.mouseEnter(root);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const bridge = root.querySelector(".radial-node-menu__hover-bridge");
    expect(bridge).not.toBeNull();
    expect(root.contains(bridge)).toBe(true);
    // React's onMouseLeave fires from a "mouseout" whose relatedTarget has
    // left the element's subtree. The bridge exists precisely so that the
    // physical gap the mouse crosses between the trigger and a fanned-out
    // node still has a relatedTarget *inside* root - without it this
    // transition would report leaving root entirely and collapse the
    // branch mid-sweep.
    fireEvent.mouseOut(trigger, { relatedTarget: bridge });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("toggles open/closed on click (touch fallback)", () => {
    renderMenu();
    const trigger = screen.getByLabelText("Open menu");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("collapses on a pointerdown outside the menu", () => {
    renderMenu();
    const trigger = screen.getByLabelText("Open menu");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("selecting a fanned node fires onSelect and closes the branch", () => {
    const { onSelect } = renderMenu();
    const trigger = screen.getByLabelText("Open menu");
    fireEvent.click(trigger);

    fireEvent.click(screen.getByLabelText("Option B"));

    expect(onSelect).toHaveBeenCalledWith("b");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("renders active nodes as menuitemradio and inactive ones as menuitem", () => {
    renderMenu();
    fireEvent.click(screen.getByLabelText("Open menu"));

    const optionA = screen.getByLabelText("Option A");
    const optionB = screen.getByLabelText("Option B");
    expect(optionA).toHaveAttribute("role", "menuitemradio");
    expect(optionA).toHaveAttribute("aria-checked", "true");
    expect(optionB).toHaveAttribute("role", "menuitemradio");
    expect(optionB).toHaveAttribute("aria-checked", "false");
  });

  it("plain action nodes (no `active`) render as a menuitem with no aria-checked", () => {
    const onSelect = vi.fn();
    render(
      <RadialNodeMenu
        trigger={<span>Trigger</span>}
        triggerLabel="Open menu"
        nodes={[{ key: "go", icon: <span>Go</span>, label: "Go", onSelect }]}
      />,
    );
    fireEvent.click(screen.getByLabelText("Open menu"));

    const item = screen.getByLabelText("Go");
    expect(item).toHaveAttribute("role", "menuitem");
    expect(item).not.toHaveAttribute("aria-checked");
  });

  it("a `toggle` node renders as menuitemcheckbox instead of menuitemradio", () => {
    const onSelect = vi.fn();
    render(
      <RadialNodeMenu
        trigger={<span>Trigger</span>}
        triggerLabel="Open menu"
        nodes={[
          {
            key: "mute",
            icon: <span>M</span>,
            label: "Mute",
            active: true,
            toggle: true,
            activeTone: "danger",
            onSelect,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByLabelText("Open menu"));

    const item = screen.getByLabelText("Mute");
    expect(item).toHaveAttribute("role", "menuitemcheckbox");
    expect(item).toHaveAttribute("aria-checked", "true");
    expect(item.className).toContain("radial-node-menu__fan-node--active");
    expect(item.className).toContain("radial-node-menu__fan-node--tone-danger");
  });

  it("an active node with no activeTone (or 'accent') gets no tone modifier class", () => {
    const onSelect = vi.fn();
    render(
      <RadialNodeMenu
        trigger={<span>Trigger</span>}
        triggerLabel="Open menu"
        nodes={[
          {
            key: "a",
            icon: <span>A</span>,
            label: "A",
            active: true,
            onSelect,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByLabelText("Open menu"));

    const item = screen.getByLabelText("A");
    expect(item.className).toContain("radial-node-menu__fan-node--active");
    expect(item.className).not.toMatch(/--tone-/);
  });

  it("spreads every node out (not just the first two) across the fan", () => {
    renderMenu();
    fireEvent.click(screen.getByLabelText("Open menu"));

    expect(screen.getByLabelText("Option A")).toBeInTheDocument();
    expect(screen.getByLabelText("Option B")).toBeInTheDocument();
    expect(screen.getByLabelText("Option C")).toBeInTheDocument();
  });

  describe("edge-avoidance shift", () => {
    afterEach(() => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 1024,
      });
    });

    it("shifts the fan left when a node would clip the right edge of the viewport", () => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 400,
      });
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        top: 0,
        bottom: 0,
        left: 380,
        right: 420,
        width: 40,
        height: 20,
        x: 380,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);

      renderMenu();
      fireEvent.click(screen.getByLabelText("Open menu"));

      const item = screen
        .getByLabelText("Option A")
        .closest(".radial-node-menu__fan-item") as HTMLElement;
      const fanX = item.style.getPropertyValue("--fan-x");
      // Base offset for a 3-node fan's first item is negative (left side);
      // a rightward clip should push shiftX negative too, so the combined
      // value stays well below the unshifted base.
      expect(parseFloat(fanX)).toBeLessThan(-20);
    });

    it("shifts the fan right when a node would clip the left edge of the viewport", () => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        top: 0,
        bottom: 0,
        left: -20,
        right: 20,
        width: 40,
        height: 20,
        x: -20,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);

      renderMenu();
      fireEvent.click(screen.getByLabelText("Open menu"));

      // Option C sits rightmost in the base (unshifted) fan, so a
      // rightward shift is unambiguous here (unlike Option A, whose
      // negative base offset a rightward shift would only partially
      // cancel out).
      const item = screen
        .getByLabelText("Option C")
        .closest(".radial-node-menu__fan-item") as HTMLElement;
      const fanX = item.style.getPropertyValue("--fan-x");
      expect(parseFloat(fanX)).toBeGreaterThan(20);
    });
  });
});
