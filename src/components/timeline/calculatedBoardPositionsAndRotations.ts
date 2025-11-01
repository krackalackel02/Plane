import * as THREE from "three";
import { boardJsonProps } from "../types/boardTypes";

export const calculatedBoardPositionsAndRotations = (
  items: boardJsonProps[],
  method: string = "linear",
) => {
  switch (method) {
    case "arc":
      return calculatedBoardData_arc(items);
    case "linear":
      return calculatedBoardData_linear(items);
    default:
      return calculatedBoardData_linear(items);
  }
};

export const calculatedBoardData_arc = (
  items: boardJsonProps[],
  deg: number = 180,
) => {
  const boardCount = items.length;
  const boardWidth = 6.7;
  const gap = 10.0;
  const arcCenter = new THREE.Vector3(0, 0, 0);
  const totalArcAngle = Math.PI * (deg / 180); // Convert degrees to radians

  const totalArcLength = boardCount * boardWidth + (boardCount - 1) * gap;
  const radius = totalArcLength / totalArcAngle;

  // --- Start of new mapping logic ---

  // We want the arc to be centered on the +Z axis,
  // so it will span from -90 deg (-X axis) to +90 deg (+X axis).
  const startAngle = Math.PI / 2; // Start at -PI/2

  // Calculate the angular size of one board and one gap
  const anglePerBoard = boardWidth / radius;
  const anglePerGap = gap / radius;

  // The angular distance from the center of one board to the next
  const angleStep = anglePerBoard + anglePerGap;

  return items.map((item, i) => {
    // Calculate the angle for the CENTER of the current board
    // (Start Angle) + (Half a board) + (index * full step)
    const angleDelta = anglePerBoard / 2 + i * angleStep;
    const angle = startAngle - angleDelta;

    // Calculate position on the XZ plane (Y=0)
    // We use sin(angle) for X and cos(angle) for Z to place items
    // starting from the -X axis (at -PI/2) and moving to +X (at +PI/2).
    const position: [number, number, number] = [
      arcCenter.x + radius * Math.sin(angle),
      arcCenter.y,
      arcCenter.z + radius * Math.cos(angle),
    ];

    // Calculate rotation
    // The board is at 'angle'. To make it face the origin (0,0,0),
    // we need to rotate it by 'angle' + 180 degrees (PI).
    const rotation: [number, number, number] = [0, -Math.PI / 2 + angle, 0];

    return {
      ...item,
      position,
      rotation,
    };
  });
};

export const calculatedBoardData_linear = (items: boardJsonProps[]) => {
  // Base position for the first board
  const basePosition: [number, number, number] = [4.0, 1.5, 10];

  // Offset between boards along the z-axis
  const offsetZ = 10.0;

  return items.map((item, i) => {
    const position: [number, number, number] = [
      basePosition[0],
      basePosition[1],
      basePosition[2] + i * offsetZ,
    ];

    // No rotation needed for linear arrangement
    const rotation: [number, number, number] = [0, 0, 0];

    return {
      ...item,
      position,
      rotation,
    };
  });
};
