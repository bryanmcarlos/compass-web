"use client";

import { Suspense, useActionState, useState, type ComponentType } from "react";
import { useSearchParams } from "next/navigation";
import {
  Compass,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LoaderCircle,
  CircleAlert,
  CircleCheck,
  LogIn,
  UserPlus,
} from "lucide-react";
import { login, signup, type AuthFormState } from "@/app/auth/actions";

type Mode = "login" | "signup";

const initialAuthState: AuthFormState = { status: "idle", message: null };

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);

  const [loginState, loginAction, loginPending] = useActionState(
    login,
    initialAuthState,
  );
  const [signupState, signupAction, signupPending] = useActionState(
    signup,
    initialAuthState,
  );

  const state = mode === "login" ? loginState : signupState;
  const pending = mode === "login" ? loginPending : signupPending;
  const action = mode === "login" ? loginAction : signupAction;

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-light px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-sand bg-off-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-1 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-forest/10 text-forest">
            <Compass className="h-6 w-6" />
          </span>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-charcoal">
            COMPASS
          </h1>
          <p className="text-sm text-charcoal-light/80">
            {mode === "login"
              ? "Welcome back, adventurer."
              : "Join the community."}
          </p>
        </div>

        <Suspense fallback={null}>
          <ConfirmationError />
        </Suspense>

        <div className="mb-6 flex rounded-full bg-sand-light p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-full px-4 py-2 transition-colors ${
              mode === "login"
                ? "bg-forest text-off-white shadow-sm"
                : "text-charcoal-light/80 hover:text-charcoal"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-full px-4 py-2 transition-colors ${
              mode === "signup"
                ? "bg-forest text-off-white shadow-sm"
                : "text-charcoal-light/80 hover:text-charcoal"
            }`}
          >
            Create Account
          </button>
        </div>

        <form key={mode} action={action} className="flex flex-col gap-4">
          <Field
            id="email"
            name="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            icon={Mail}
            autoComplete="email"
            required
          />

          <PasswordField
            id="password"
            name="password"
            label="Password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "signup" ? 8 : undefined}
            show={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
          />

          {mode === "signup" && (
            <PasswordField
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm password"
              autoComplete="new-password"
              minLength={8}
              show={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
            />
          )}

          {state.status !== "idle" && state.message && (
            <div
              role="alert"
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                state.status === "error"
                  ? "border-error/30 bg-error-bg text-error"
                  : "border-forest/30 bg-forest/10 text-forest-dark"
              }`}
            >
              {state.status === "error" ? (
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{state.message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : mode === "login" ? (
              <LogIn className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {pending
              ? "Please wait…"
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-charcoal-light/80">
          {mode === "login" ? (
            <>
              New to the club?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="font-semibold text-forest hover:underline"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already a member?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="font-semibold text-forest hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function ConfirmationError() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  if (!error) return null;

  return (
    <div
      role="alert"
      className="mb-6 flex items-start gap-2 rounded-lg border border-error/30 bg-error-bg p-3 text-sm text-error"
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error}</span>
    </div>
  );
}

function Field({
  id,
  name,
  type,
  label,
  placeholder,
  icon: Icon,
  autoComplete,
  required,
}: {
  id: string;
  name: string;
  type: string;
  label: string;
  placeholder?: string;
  icon: ComponentType<{ className?: string }>;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-charcoal">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-charcoal-light/60" />
        <input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className="w-full rounded-lg border border-sand bg-off-white py-2 pr-3 pl-9 text-base text-charcoal placeholder:text-charcoal-light/50 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
        />
      </div>
    </div>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  minLength,
  show,
  onToggle,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete?: string;
  minLength?: number;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-charcoal">
        {label}
      </label>
      <div className="relative">
        <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-charcoal-light/60" />
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          className="w-full rounded-lg border border-sand bg-off-white py-2 pr-10 pl-9 text-base text-charcoal placeholder:text-charcoal-light/50 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 text-charcoal-light/60 hover:text-charcoal"
        >
          {show ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
