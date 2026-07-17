import React, { useEffect, useMemo, useState } from "react";

const allSteps = [
  { selector: '[data-tour="dashboard"]', title: "Your dashboard", text: "This is your home workspace. It shows documents and work waiting for your role." },
  { selector: '[data-tour="create"]', title: "Create new work", text: "Start a customer onboarding or maintenance request here when your role allows it." },
  { selector: '[data-tour="stats"]', title: "Work at a glance", text: "These cards summarize pending, returned, completed, and visible documents." },
  { selector: '[data-tour="documents"]', title: "Find and process documents", text: "Search, filter, open, and continue documents assigned to your department." },
  { selector: '[data-tour="summaries"]', title: "Client summaries", text: "Open completed client summaries and download the available documents." },
  { selector: '[data-tour="reports"]', title: "Reports", text: "Review workflow reporting and overall activity from this section." },
  { selector: '[data-tour="account"]', title: "Your account", text: "Your assigned role and department control which information and actions you can access." },
];

export default function GuidedTour({ open, onClose }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const steps = useMemo(() => allSteps.filter((step) => document.querySelector(step.selector)), [open]);
  const step = steps[Math.min(stepIndex, Math.max(steps.length - 1, 0))];

  useEffect(() => { if (open) setStepIndex(0); }, [open]);
  useEffect(() => {
    if (!open || !step) return undefined;
    const update = () => {
      const element = document.querySelector(step.selector);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setTargetRect(element.getBoundingClientRect()), 180);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open, step]);

  if (!open || !step || !targetRect) return null;
  const below = targetRect.bottom + 18;
  const top = below + 230 < window.innerHeight ? below : Math.max(16, targetRect.top - 245);
  const left = Math.min(Math.max(16, targetRect.left), Math.max(16, window.innerWidth - 376));
  return (
    <div className="tour-layer" role="dialog" aria-modal="true" aria-label="Zanlink guided tour">
      <div className="tour-spotlight" style={{ top: targetRect.top - 6, left: targetRect.left - 6, width: targetRect.width + 12, height: targetRect.height + 12 }} />
      <section className="tour-card" style={{ top, left }}>
        <span className="tour-count">Step {stepIndex + 1} of {steps.length}</span>
        <h2>{step.title}</h2><p>{step.text}</p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={onClose}>Skip tour</button>
          <div>
            {stepIndex > 0 && <button type="button" className="btn secondary" onClick={() => setStepIndex(stepIndex - 1)}>Back</button>}
            <button type="button" className="btn" onClick={() => stepIndex === steps.length - 1 ? onClose() : setStepIndex(stepIndex + 1)}>{stepIndex === steps.length - 1 ? "Finish" : "Next"}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
