/**
 * Whether a WebGL renderer string names a CPU rasteriser rather than a GPU:
 * Chrome's SwiftShader (its fallback when there's no usable GPU or the driver
 * is blocklisted - and every headless CI browser), Mesa's llvmpipe/softpipe,
 * or Windows' Microsoft Basic Render Driver.
 */
export const isSoftwareRendererName = (renderer: string): boolean =>
  /swiftshader|llvmpipe|softpipe|software rasterizer|basic render/i.test(
    renderer,
  );

let probed: boolean | undefined;

/**
 * Whether WebGL in this browser is drawn on the CPU - probed once, with a
 * throwaway context that's released straight after.
 *
 * Where it is, every pixel and every draw call costs CPU time the page's own
 * main thread then waits on: the full-quality scene (soft shadows over the
 * whole planet, a 2x-density canvas) ran at ~2 frames a second and starved
 * the page of input. So the scene renders those browsers at 1x density
 * without shadows, and everything with a real GPU exactly as before.
 *
 * False wherever there's no WebGL to probe at all (e.g. jsdom): the
 * full-quality default.
 */
export const isSoftwareRendered = (): boolean => {
  if (probed !== undefined) return probed;
  probed = false;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ??
      canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (gl) {
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = String(
        gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      );
      probed = isSoftwareRendererName(renderer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    // No WebGL to ask: assume a GPU.
  }
  return probed;
};
