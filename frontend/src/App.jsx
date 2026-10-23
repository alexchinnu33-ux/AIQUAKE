import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import CommandCenter from "./pages/CommandCenter";
import GISMap from "./pages/GISMap";
import RescuePlanner from "./pages/RescuePlanner";
import MissionControl from "./pages/MissionControl";
import NewIncident from "./pages/NewIncident";
import Landing from "./pages/Landing";
import ModelPerformance from "./pages/ModelPerformance";
import EarthquakeHistory from "./pages/EarthquakeHistory";


function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return children;
}


function App() {
  return (
    <BrowserRouter>

      <Routes>

        <Route
          path="/"
          element={<Landing />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MissionControl />
            </ProtectedRoute>
          }
        />

        <Route
          path="/new"
          element={
            <ProtectedRoute>
              <NewIncident />
            </ProtectedRoute>
          }
        />

        <Route
          path="/classifier"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/command-center"
          element={
            <ProtectedRoute>
              <CommandCenter />
            </ProtectedRoute>
          }
        />

        <Route
          path="/gis"
          element={
            <ProtectedRoute>
              <GISMap />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rescue"
          element={
            <ProtectedRoute>
              <RescuePlanner />
            </ProtectedRoute>
          }
        />

        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <EarthquakeHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/model"
          element={
            <ProtectedRoute>
              <ModelPerformance />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>

    </BrowserRouter>
  );
}


export default App;