import { Route, Routes } from "react-router-dom";
import Leaderboard from "./views/Leaderboard";
import EpisodeReplay from "./views/EpisodeReplay";
import Tasks from "./views/Tasks";
import { Landing } from "./views/Landing";
import { Footer } from "./components/layout/Footer";
import { Nav } from "./components/layout/Nav";
import { ParticleField } from "./components/effects/ParticleField";
import BattleView from "./views/battle/BattleView";

export default function App() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-ink)] antialiased">
      <ParticleField />
      <div className="relative z-10">
        <Nav />
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
    </div>
  );
}
