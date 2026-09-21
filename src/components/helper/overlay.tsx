import { useEnvironment } from "../../context/envContext";

/**
 * Overlay component for displaying camera information
 * @returns JSX.Element | null
 */
const Overlay = () => {
  const { showCameraHelper } = useEnvironment();

  return (
    showCameraHelper && (
      <div id="camera-vectors">
        <span>Free Camera Vectors:</span>
        <br />
        Position: <span id="position"></span>
        <br />
        Looking at: <span id="lookingAt"></span>
        <br />
        <button
          onClick={() => {
            // Get values from spans
            const positionSpan = document.getElementById("position")?.innerText;
            const lookingAtSpan =
              document.getElementById("lookingAt")?.innerText;

            if (positionSpan && lookingAtSpan) {
              const position = "Position: " + positionSpan;
              const lookingAt = "LookingAt: " + lookingAtSpan;
              const data = position + "\n" + lookingAt;
              navigator.clipboard
                .writeText(data)
                .then(() => {
                  console.log("Data copied to clipboard!");
                })
                .catch((err) => {
                  console.error("Failed to copy to clipboard: ", err);
                });
            }
          }}
        >
          copy
        </button>
        <br />
        <button
          onClick={() => {
            // Get values from spans
            const positionSpan = document.getElementById("position")?.innerText;
            const lookingAtSpan =
              document.getElementById("lookingAt")?.innerText;

            if (positionSpan && lookingAtSpan) {
              // Parse values into JSON
              const parseValues = (text: string) =>
                Object.fromEntries(
                  text.split(",").map((part) => {
                    const [key, value] = part.trim().split(":");
                    return [key.trim(), parseFloat(value)];
                  }),
                );

              const position = parseValues(positionSpan);
              const lookingAt = parseValues(lookingAtSpan);

              const data = {
                position,
                lookingAt,
              };

              // Create and download the JSON file
              const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "cameraPos.json";
              a.click();
              URL.revokeObjectURL(url);
            }
          }}
        >
          save
        </button>
      </div>
    )
  );
};

export default Overlay;
