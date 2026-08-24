"use client";

import { IconAlertCircle, IconEye, IconEyeOff } from "@tabler/icons-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { signIn } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="auth-submit" disabled={pending} type="submit">
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function SignInForm({ hasError }: { hasError: boolean }) {
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <form action={signIn} className="auth-form">
      {hasError ? (
        <p className="auth-form__error" id="auth-error" role="alert">
          <IconAlertCircle aria-hidden="true" size={15} stroke={1.75} />
          <span>
            Username or password not recognised. Check the station you signed in
            from.
          </span>
        </p>
      ) : null}

      <label className="auth-field">
        <span>Username</span>
        <input
          aria-describedby={hasError ? "auth-error" : undefined}
          autoCapitalize="none"
          autoComplete="username"
          name="username"
          placeholder="a.kim"
          required
          spellCheck={false}
          type="text"
        />
      </label>

      <div className="auth-field">
        <div className="auth-field__label-row">
          <label htmlFor="auth-password">Password</label>
          <span aria-disabled="true" className="auth-forgot">
            Forgot password
          </span>
        </div>
        <div className="auth-password">
          <input
            aria-describedby={hasError ? "auth-error" : undefined}
            autoComplete="current-password"
            id="auth-password"
            name="password"
            placeholder="••••••••"
            required
            type={passwordVisible ? "text" : "password"}
          />
          <button
            aria-label={passwordVisible ? "Hide password" : "Show password"}
            className="auth-password__toggle"
            onClick={() => setPasswordVisible((visible) => !visible)}
            type="button"
          >
            {passwordVisible ? (
              <IconEyeOff aria-hidden="true" size={15} stroke={1.75} />
            ) : (
              <IconEye aria-hidden="true" size={15} stroke={1.75} />
            )}
          </button>
        </div>
      </div>

      <label className="auth-remember">
        <input defaultChecked name="remember" type="checkbox" />
        <span>Keep me signed in on this station</span>
      </label>

      <SubmitButton />
    </form>
  );
}
