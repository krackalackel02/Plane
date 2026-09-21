import "@testing-library/jest-dom";

// jsdom has no PointerEvent implementation, so fireEvent.pointerDown/Move/Up
// on components that read event.clientX/clientY/pointerId (e.g. drag-based
// touch controls) would otherwise silently receive undefined values.
if (typeof window.PointerEvent === "undefined") {
  class PointerEvent extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
    }
  }
  window.PointerEvent = PointerEvent;
}
