import React from 'react';
import DitheredFooter, { footerIcon } from '../ui/dithered-footer';

const GITHUB_PATH =
  "M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5";

export const Footer: React.FC = () => {
  return (
    <DitheredFooter
      brand="AgentGym"
      brandHref="/"
      tagline="The proving ground for coding agents. Watch AI learn to code — every run recorded, scored, and replayable."
      accent="#76B900"
      showSubscribe={false}
      columns={[
        {
          title: 'Project',
          links: [
            { label: 'Leaderboard', href: '/leaderboard' },
            { label: 'Replay Viewer', href: '/replay' },
            { label: 'Task Set', href: '/tasks' },
          ],
        },
        {
          title: 'Data',
          links: [
            { label: 'Nebius Token Factory', href: 'https://tokenfactory.nebius.com' },
            { label: 'Nemotron Nano · Super · Ultra', href: 'https://build.nvidia.com' },
            { label: 'JSONL Format', href: 'https://jsonlines.org' },
          ],
        },
        {
          title: 'Legal',
          links: [
            { label: 'MIT License', href: 'https://github.com/Shivain-codes/Agent-gym-/blob/main/LICENSE' },
          ],
        },
      ]}
      socials={[
        { label: 'GitHub', href: 'https://github.com/Shivain-codes/Agent-gym-', icon: footerIcon(GITHUB_PATH) },
      ]}
      legal={[]}
      copyright="© 2026 AgentGym // MIT License"
      status={{ label: 'API operational', href: '/api/health' }}
      footnote="Official entry · Coding & Agentic Engineering · Nebius × NVIDIA Global AI Hackathon"
    />
  );
};
