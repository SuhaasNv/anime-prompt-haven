"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import "driver.js/dist/driver.css";

import {
  CURRENT_USER_QUERY_KEY,
  getCurrentUser,
  markTourComplete,
} from "@/lib/api/auth.functions";

// driver.js (not react-joyride) because react-joyride relies on react-dom APIs
// removed in React 19 and silently renders nothing here. driver.js manipulates
// the DOM directly, so it's framework-version-agnostic.

type TourStep = {
  element: string;
  popover: {
    title?: string;
    description: string;
    side?: "top" | "bottom" | "left" | "right";
    align?: "start" | "center" | "end";
  };
};

// Each step anchors to a `data-tour="…"` attribute on existing UI. Steps whose
// anchor isn't on the page are filtered out so a missing target can't break the tour.
const STEPS: TourStep[] = [
  {
    element: '[data-tour="market"]',
    popover: {
      title: "Welcome to PromptStar! ✨",
      description: "This is the Market — browse trending and community-published prompts.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="explore"]',
    popover: {
      description: "Explore lets you filter prompts by style, model, and category.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="binder"]',
    popover: {
      description: "Your Binder keeps saved prompts, purchases, and custom collections.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="contribute"]',
    popover: {
      description: "Publish your own prompt here — earn credits when people buy or copy it.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="credits"]',
    popover: {
      description: "Your credit balance. Earn by publishing, selling, and getting saves.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="studio"]',
    popover: {
      description: "Studio — customize your companion, accent theme, and profile.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="mascot-chat"]',
    popover: {
      title: "Meet your AI companion! 🤖",
      description:
        "Click your mascot anytime to open the AI chatbot. Ask it to find prompts, manage your binder, craft better prompts, or answer any platform question.",
      side: "top",
      align: "end",
    },
  },
];

/**
 * First-run guided tour. `run` should be true only for an onboarded user who
 * hasn't completed the tour. On finish or close it records completion so it
 * never reappears (replayable from Studio).
 */
export function ProductTour({ run }: { run: boolean }) {
  const queryClient = useQueryClient();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!run || startedRef.current) return;
    startedRef.current = true;
    let active = true;

    void import("driver.js").then(({ driver }) => {
      if (!active) return;
      const steps = STEPS.filter((s) => document.querySelector(s.element));
      if (steps.length === 0) return;

      let completed = false;
      const markDone = () => {
        if (completed) return;
        completed = true;
        void markTourComplete()
          .then(() => getCurrentUser())
          .then((u) => queryClient.setQueryData(CURRENT_USER_QUERY_KEY, u))
          .catch(() => {
            /* best-effort: a failed write just means the tour may show once more */
          });
      };

      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const tour = driver({
        showProgress: true,
        allowClose: true,
        animate: !reduceMotion,
        overlayColor: "rgba(10, 10, 12, 0.6)",
        popoverClass: "promptstar-tour",
        nextBtnText: "Next →",
        prevBtnText: "← Back",
        doneBtnText: "Got it!",
        steps,
        onDestroyed: markDone,
      });
      tour.drive();
    });

    return () => {
      active = false;
    };
  }, [run, queryClient]);

  return null;
}
