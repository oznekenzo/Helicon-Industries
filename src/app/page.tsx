import type { Metadata } from "next";

import { BrandLockup } from "@/components/ui/brand-lockup";
import { SignInForm } from "@/features/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Helicon Control Tower",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const hasError = error === "invalid";

  return (
    <main className="auth-page">
      <section className="auth-context" aria-label="Control Tower context">
        <BrandLockup className="auth-brand" variant="product" />

        <div className="auth-context__intro">
          <h1>Helicon Control Tower</h1>
          <p>See how the facility is running and what needs attention.</p>
          <div
            aria-label="Twelve of sixteen status segments active"
            className="auth-status-strip"
            role="img"
          >
            {Array.from({ length: 16 }, (_, index) => (
              <span
                className={index < 12 ? "is-active" : undefined}
                key={index}
              />
            ))}
          </div>
        </div>

        <div className="auth-context__facts">
          <div>
            <span>FACILITIES</span>
            <strong>la_01 · la_02</strong>
          </div>
          <div>
            <span>SNAPSHOT</span>
            <strong>13 AUG 2026, 23:06 UTC</strong>
          </div>
        </div>
      </section>

      <section aria-labelledby="sign-in-heading" className="auth-panel">
        <div className="auth-panel__content">
          <div className="auth-panel__intro">
            <h2 id="sign-in-heading">Sign in</h2>
            <p>Use your facility operations account.</p>
          </div>

          <SignInForm hasError={hasError} />
        </div>
      </section>
    </main>
  );
}
