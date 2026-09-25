// Main Css file for global styles
import "./App.css";

// Scene Component
import Scene from "./components/scene";
import { LoadingProvider } from "./context/loadingContext";

/**
 * Main application component
 * @returns JSX.Element
 */
function App() {
  return (
    <LoadingProvider>
      <Scene />
    </LoadingProvider>
  );
}

export default App;
