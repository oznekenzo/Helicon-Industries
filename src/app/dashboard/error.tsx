"use client";

import { IconAlertTriangleFilled } from "@tabler/icons-react";

import { BrandLockup } from "@/components/ui/brand-lockup";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="dashboard-error-page">
      <BrandLockup className="dashboard-error-page__brand" variant="product" />
      <section
        aria-labelledby="dashboard-error-heading"
        className="dashboard-error-card"
        role="alert"
      >
        <span aria-hidden="true" className="dashboard-error-card__icon">
          <IconAlertTriangleFilled size={20} stroke={0} />
        </span>
        <p className="dashboard-error-card__eyebrow">Snapshot unavailable</p>
        <h1 id="dashboard-error-heading">Control Tower couldn’t load</h1>
        <p className="dashboard-error-card__message">
          The latest facility snapshot could not be retrieved. Your session is
          still active; try loading the dashboard again.
        </p>
        {error.digest ? (
          <p className="dashboard-error-card__reference">
            Reference: {error.digest}
          </p>
        ) : null}
        <button
          className="dashboard-error-card__retry"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
