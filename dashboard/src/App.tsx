import { Route, Routes, useLocation } from "react-router-dom";
import Leaderboard from "./views/Leaderboard";
import EpisodeReplay from "./views/EpisodeReplay";
import Tasks from "./views/Tasks";
import { Landing } from "./views/Landing";
import { Footer } from "./components/layout/Footer";
import { Nav } from "./components/layout/Nav";
import BattleView from "./views/battle/BattleView";

export default function App() {
  const location = useLocation();
  // Landing has its own inline hero nav; every other page gets the shared sticky nav.
  const showNav = location.pathname !== "/";

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-ink)] antialiased">
      {showNav && <Nav />}
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/replay" element={<EpisodeReplay />} />
          <Route path="/replay/:episodeId" element={<EpisodeReplay />} />
          <Route path="/battle" element={<BattleView />} />
          <Route path="/tasks" element={<Tasks />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
