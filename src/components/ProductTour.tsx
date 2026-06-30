"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CallBackProps, Step } from "react-joyride";

import {
  CURRENT_USER_QUERY_KEY,
  getCurrentUser,
  markTourComplete,
} from "@/lib/api/auth.functions";

type JoyrideComponent = (typeof import("react-joyride"))["default"];

// Each step anchors to a `data-tour="…"` attribute added (additively) to existing
// UI. Steps whose target isn't on the page are filtered out at runtime so a
// missing anchor never stalls the tour.
const STEPS: Step[] = [
  {
    target: '[data-tour="market"]',
    title: "Welcome to PromptStar! ✨",
    content: "This is the Market — browse trending and community-published prompts.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="explore"]',
    content: "Explore lets you filter prompts by style, model, and category.",
    placement: "bottom",
  },
  {
    target: '[data-tour="binder"]',
    content: "Your Binder keeps saved prompts, purchases, and custom collections.",
    placement: "bottom",
  },
  {
    target: '[data-tour="contribute"]',
    content: "Publish your own prompt here — earn credits when people buy or copy it.",
    placement: "bottom",
  },
  {
    target: '[data-tour="credits"]',
    content: "Your credit balance. Earn by publishing, selling, and getting saves.",
    placement: "bottom",
  },
  {
    target: '[data-tour="studio"]',
    content: "Studio — customize your companion, accent theme, and profile.",
    placement: "bottom",
  },
];

const POP_STYLES = {
  options: {
    primaryColor: "#d400ff",
    textColor: "#0a0a0c",
    backgroundColor: "#ffffff",
    arrowColor: "#ffffff",
    overlayColor: "rgba(10, 10, 12, 0.6)",
    zIndex: 10000,
  },
  tooltip: { borderRadius: 0, border: "3px solid #0a0a0c", padding: 20 },
  tooltipTitle: { fontWeight: 800, textTransform: "uppercase" as const },
  buttonNext: {
    borderRadius: 0,
    border: "2px solid #0a0a0c",
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  buttonBack: { color: "#0a0a0c", fontWeight: 700 },
  spotlight: { borderRadius: 4 },
};

/**
 * First-run guided tour. `run` should be true only for an onboarded user who
 * hasn't completed the tour. On finish or skip it records completion server-side
 * and updates the cached session so it never reappears.
 */
export function ProductTour({ run }: { run: boolean }) {
  const queryClient = useQueryClient();
  const [Joyride, setJoyride] = useState<JoyrideComponent | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [active, setActive] = useState(false);

  // Client-only: avoids any window access during SSR.
  useEffect(() => {
    let mounted = true;
    void import("react-joyride").then((m) => {
      if (mounted) setJoyride(() => m.default);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Only include steps whose anchor is actually on the page.
  useEffect(() => {
    if (!run || !Joyride) return;
    const present = STEPS.filter(
      (s) => typeof s.target === "string" && document.querySelector(s.target),
    );
    setSteps(present);
    setActive(present.length > 0);
  }, [run, Joyride]);

  if (!Joyride || !active || steps.length === 0) return null;

  const handleCallback = (data: CallBackProps) => {
    if (data.status === "finished" || data.status === "skipped") {
      setActive(false);
      void markTourComplete()
        .then(() => getCurrentUser())
        .then((u) => queryClient.setQueryData(CURRENT_USER_QUERY_KEY, u))
        .catch(() => {
          /* best-effort: a failed write just means the tour may show once more */
        });
    }
  };

  return (
    <Joyride
      steps={steps}
      run={active}
      continuous
      showProgress
      showSkipButton
      disableScrollParentFix
      scrollToFirstStep
      callback={handleCallback}
      styles={POP_STYLES}
      locale={{ last: "Got it!", skip: "Skip tour" }}
    />
  );
}
