// Main Css file for global styles
import "./App.css";

// Scene Component
import Scene from "./components/scene";
import LoadingScreen from "./components/helper/loadingScreen";
import { LoadingProvider } from "./context/loadingContext";

/**
 * Main application component
 * @returns JSX.Element
 */
function App() {
  return (
    <LoadingProvider>
      <LoadingScreen />
      <Scene />
    </LoadingProvider>
  );
}

export default App;
