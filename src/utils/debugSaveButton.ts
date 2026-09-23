import { button } from "leva";

// Split out of utils/3d.ts so leva only reaches the app's dependency graph
// through the lazy-loaded debug-controls components that use this, not
// through 3d.ts's other (eagerly-used) exports - keeps leva out of the
// main bundle.

/**
 * Create a save button for downloading JSON data.
 * @param data - The data to be saved.
 * @param filename - The name of the file to save.
 * @returns A button component.
 */
export const createSaveButton = (data: unknown, filename: string) =>
  button(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
