import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { KeyProvider } from "../../context/keyContext";

const { deviceState } = vi.hoisted(() => ({
  deviceState: { isMobile: false },
}));

vi.mock("react-device-detect", () => ({
  MobileView: ({ children }: { children: React.ReactNode }) =>
    deviceState.isMobile ? <>{children}</> : null,
}));

import MobileControls from "./mobileControls";

const setup = () =>
  render(
    <KeyProvider>
      <MobileControls />
    </KeyProvider>,
  );

describe("MobileControls", () => {
  it("renders nothing on a non-mobile device", () => {
    deviceState.isMobile = false;
    const { container } = setup();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the joystick on a mobile device", () => {
    deviceState.isMobile = true;
    const { container } = setup();
    expect(container.querySelector(".circular-stick-track")).toBeTruthy();
  });
});
