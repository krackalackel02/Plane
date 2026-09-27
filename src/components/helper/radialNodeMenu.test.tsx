import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

  it("starts collapsed with the vertical list hidden", () => {
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

  it("selecting a list node fires onSelect and closes the branch", () => {
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

  it("renders up to two arc nodes flanking the trigger", () => {
    const onSelect = vi.fn();
    render(
      <RadialNodeMenu
        trigger={<span>Trigger</span>}
        triggerLabel="Open menu"
        nodes={[]}
        arcNodes={[
          { key: "left", icon: <span>L</span>, label: "Left action", onSelect },
          {
            key: "right",
            icon: <span>R</span>,
            label: "Right action",
            onSelect,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByLabelText("Open menu"));

    fireEvent.click(screen.getByLabelText("Left action"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  describe("edge-avoidance alignment", () => {
    let originalInnerWidth: number;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
    });

    afterEach(() => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
    });

    it("anchors the panel to the right edge of the trigger when it would clip the right of the viewport", () => {
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

      const trigger = screen.getByLabelText("Open menu");
      const root = trigger.parentElement as HTMLElement;
      expect(root.className).toContain("radial-node-menu--align-right");
    });

    it("anchors the panel to the left edge of the trigger when it would clip the left of the viewport", () => {
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

      const trigger = screen.getByLabelText("Open menu");
      const root = trigger.parentElement as HTMLElement;
      expect(root.className).toContain("radial-node-menu--align-left");
    });
  });
});
