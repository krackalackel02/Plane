import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GlitchText from "./glitchText";

describe("GlitchText", () => {
  // The welcome popup is centred: if the scramble itself were laid out, its
  // re-wrapping lines resized the panel every frame and moved its close
  // button around while the text resolved.
  it("lays its box out with the final text from the very first frame", () => {
    const { container } = render(
      <GlitchText as="p" text="Welcome aboard, pilot" startDelayMs={5000} />,
    );
    const final = container.querySelector(".glitch-text__final");
    expect(final?.textContent).toBe("Welcome aboard, pilot");
  });

  it("draws the scramble as a separate layer over it, hidden from assistive tech", () => {
    const { container } = render(
      <GlitchText as="p" text="Welcome aboard, pilot" startDelayMs={5000} />,
    );
    const live = container.querySelector(".glitch-text__live");
    expect(live?.getAttribute("aria-hidden")).toBe("true");
    // Still scrambled at this point - not the final text...
    expect(live?.textContent).not.toBe("Welcome aboard, pilot");
    // ...but the same length, character for character.
    expect(live?.textContent).toHaveLength("Welcome aboard, pilot".length);
  });

  it("keeps the caller's tag and class", () => {
    const { container } = render(
      <GlitchText as="p" className="welcome-alert-body" text="Hi" />,
    );
    const root = container.firstElementChild;
    expect(root?.tagName).toBe("P");
    expect(root?.classList.contains("welcome-alert-body")).toBe(true);
    expect(root?.classList.contains("glitch-text")).toBe(true);
  });
});
