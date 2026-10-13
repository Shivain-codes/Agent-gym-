import React, { useEffect, useState } from "react";
import { AnimatedSpan, Terminal, TypingAnimation } from "@/components/ui/terminal";
import { api, type EpisodeOut, type StepEvent } from "../../api";
import { cn } from "@/lib/utils";

/** Render an action as the command line the agent effectively ran. */
const describeAction = (step: StepEvent): string => {
  const a = step.action as { type?: string; cmd?: string; path?: string } | undefined;
  if (!a) return "";
  if (a.type === "run_command" && a.cmd) return a.cmd;
  if (a.type === "edit_file" && a.path) return `edit ${a.path}`;
  return (a.type ?? "act").replace(/_/g, " ");
};

/**
 * Hero terminal: a real recorded episode played back as a typing sequence.
 * No mock output — every line comes from the episode's actual steps.
 */
export const HeroTerminal: React.FC = () => {
  const [episode, setEpisode] = useState<EpisodeOut | null>(null);

  useEffect(() => {
    api
      .fixtures()
      .then((fixs) => {
        const id = fixs[0]?.episode_id;
        if (id) return api.episode(id);
        return api.episodes().then((eps) => api.episode(eps[0].episode_id));
      })
      .then(setEpisode)
      .catch(() => {});
  }, []);

  if (!episode) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[#0C0C0F] p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--color-muted-fill)]" />
        <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-[var(--color-muted-fill)]" />
        <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-[var(--color-muted-fill)]" />
      </div>
    );
  }

  const nodes: React.ReactNode[] = [];
  episode.steps.slice(0, 6).forEach((st, i) => {
    const cmd = describeAction(st);
    if (cmd) {
      nodes.push(
        <TypingAnimation
          key={`cmd-${i}`}
          duration={28}
          className="font-mono text-[13px] text-[var(--color-ink)]"
        >
          {`❯ ${cmd}`}
        </TypingAnimation>
      );
    }
    const obs = (st.observation ?? "").split("\n").slice(0, 3).join("\n").trim();
    if (obs) {
      nodes.push(
        <AnimatedSpan
          key={`obs-${i}`}
          className="whitespace-pre-wrap font-mono text-[13px] text-[var(--color-micro)]"
        >
          {obs.length > 220 ? obs.slice(0, 220).trimEnd() + "…" : obs}
        </AnimatedSpan>
      );
    }
  });
  nodes.push(
    <AnimatedSpan
      key="verdict"
      className={cn(
        "pt-2 font-mono text-[13px]",
        episode.passed ? "text-[var(--color-pass)]" : "text-[var(--color-fail)]"
      )}
    >
      {episode.passed ? "solved" : "not solved"}
      <span className="text-[var(--color-micro)]">
        {"  ·  "}judge {episode.judge_score?.toFixed(1) ?? "—"}/10
        {"  ·  "}
        {episode.steps.length} steps
      </span>
    </AnimatedSpan>
  );

  return (
    <Terminal
      className="font-mono"
      title={
        <>
          {episode.episode_id}
          {"  ·  "}
          <span className="capitalize text-[var(--color-soft-ink)]">{episode.model}</span>
        </>
      }
    >
      {nodes}
    </Terminal>
  );
};
