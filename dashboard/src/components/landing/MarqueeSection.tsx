import React, { useEffect, useState } from 'react';
import { PerspectiveMarquee } from '../ui/perspective-marquee';
import { api, type EpisodeSummary } from '../../api';

/**
 * The episode strip, rebuilt as a 3D perspective marquee.
 * Items are real recorded episode IDs — no placeholder brand names.
 */
export const MarqueeSection: React.FC = () => {
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);

  useEffect(() => {
    api.episodes().then(setEpisodes).catch(() => {});
  }, []);

  if (episodes.length === 0) return null;

  return (
    <div className="relative mt-16 h-[280px] overflow-hidden border-t border-[var(--color-hairline)]">
      <PerspectiveMarquee
        items={episodes.map((ep) => ep.episode_id)}
        fontSize={64}
        fontWeight={600}
        color="var(--color-soft-ink)"
        fadeColor="#09090B"
        background="transparent"
        pixelsPerFrame={1.5}
        rotateY={-24}
        rotateX={10}
        speed={0.8}
      />
    </div>
  );
};
