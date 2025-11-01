import React from "react";

// Galaxy component rendering a star field
import Stars from "./star";

/**
 * Galaxy component for rendering a star field
 * @returns JSX.Element
 */
const Galaxy: React.FC = () => {
  const numberOfStars = 2000; // Number of stars in the galaxy
  return (
    <>
      {/* Galaxy background with stars */}
      <Stars count={numberOfStars} />
    </>
  );
};

export default Galaxy;
