export const generateRandomPosition = (
  range: number,
): [number, number, number] => [
  (Math.random() - 0.5) * range, // X position
  (Math.random() - 0.5) * range, // Y position
  (Math.random() - 0.5) * range, // Z position
];
