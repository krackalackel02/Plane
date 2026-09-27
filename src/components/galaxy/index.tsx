import React from "react";

// Galaxy component rendering a star field
import Stars from "./star";

/**
 * Galaxy component for rendering a star field
 * @returns JSX.Element
 */
const Galaxy: React.FC = () => {
  // Stars now spread over a disk several times wider than the ship's
  // travel boundary (see star.tsx), so the count is bumped up to match -
  // otherwise the same star count spread over a much bigger area reads as
  // a visibly thinner sky even close to the ship.
  const numberOfStars = 4000;
  return (
    <>
      {/* Galaxy background with stars */}
      <Stars count={numberOfStars} />
    </>
  );
};

export default Galaxy;
