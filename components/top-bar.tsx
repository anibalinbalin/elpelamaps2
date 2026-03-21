"use client";

import { WavingHand01Icon, WavingHand02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

const ADMIN_PASSWORD = "0020";

interface TopBarProps {
  drawMode: boolean;
  parcelCount: number;
  cloudSwooshTick: number;
  cloudsCleared: boolean;
  isCloudSwooshing: boolean;
  onSwooshClouds: () => void;
}

export function TopBar({
  drawMode,
  parcelCount,
  cloudSwooshTick,
  cloudsCleared,
  isCloudSwooshing,
  onSwooshClouds,
}: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  function handleModeChange(nextDrawMode: boolean) {
    if (nextDrawMode === drawMode || isPending) {
      return;
    }

    if (nextDrawMode && !drawMode) {
      setShowPasswordDialog(true);
      return;
    }

    startTransition(() => {
      router.push(nextDrawMode ? `${pathname}?draw=true` : pathname);
    });
  }

  function handlePasswordSuccess() {
    setShowPasswordDialog(false);
    startTransition(() => {
      router.push(`${pathname}?draw=true`);
    });
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-10 flex items-start justify-between bg-gradient-to-b from-[#82b7ef]/14 via-[#82b7ef]/5 to-transparent px-5 py-4">
        <div className="flex items-baseline gap-2 pt-2">
          <span className="text-base font-bold tracking-wide text-white">
            José Ignacio Lotes Demo
          </span>
        </div>

        <div className="pointer-events-auto absolute left-1/2 top-4 -translate-x-1/2">
          <div className="flex items-center rounded-[28px] border border-white/12 bg-[rgba(28,25,26,0.92)] p-[7px] shadow-[0_18px_50px_rgba(4,16,28,0.24)] backdrop-blur-md">
            <ModeButton
              active={!drawMode}
              disabled={isPending}
              label="Viewer"
              onClick={() => handleModeChange(false)}
            />
            <ModeButton
              active={drawMode}
              disabled={isPending}
              label="Admin"
              onClick={() => handleModeChange(true)}
            />
            <div className="mx-1 h-8 w-px bg-white/10" />
            <CloudSwooshButton
              active={isCloudSwooshing}
              cleared={cloudsCleared}
              swooshTick={cloudSwooshTick}
              onClick={onSwooshClouds}
            />
          </div>
        </div>

        <div className="rounded-full border border-white/20 bg-[#0f2741]/18 px-3 py-1 text-[11px] text-white/76 shadow-[0_10px_30px_rgba(6,22,39,0.12)] backdrop-blur-md">
          {parcelCount} Parcels
        </div>
      </div>

      {showPasswordDialog && (
        <AdminPasswordDialog
          onSuccess={handlePasswordSuccess}
          onCancel={() => setShowPasswordDialog(false)}
        />
      )}
    </>
  );
}

function AdminPasswordDialog({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const PIN_LENGTH = 4;
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [error, setError] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  function trySubmit(nextDigits: string[]) {
    const code = nextDigits.join("");
    if (code.length === PIN_LENGTH) {
      if (code === ADMIN_PASSWORD) {
        onSuccess();
      } else {
        setError(true);
        setDigits(Array(PIN_LENGTH).fill(""));
        setTimeout(() => inputRefs.current[0]?.focus(), 60);
      }
    }
  }

  function handleChange(index: number, value: string) {
    // Only accept digits
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError(false);

    if (digit && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    trySubmit(next);
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
        inputRefs.current[index - 1]?.focus();
      } else {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      }
      setError(false);
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, PIN_LENGTH);
    if (!pasted) return;
    const next = Array(PIN_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    setError(false);
    const focusIdx = Math.min(pasted.length, PIN_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
    trySubmit(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-[340px] rounded-2xl border border-white/12 bg-[rgba(18,24,32,0.92)] p-6 shadow-[0_32px_80px_rgba(4,16,28,0.4)] backdrop-blur-xl">
        <div className="mb-6 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/42">
            Admin Access
          </div>
          <div className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em] text-white">
            Enter PIN
          </div>
        </div>

        <div className="flex justify-center gap-3" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`h-14 w-12 rounded-xl border bg-white/[0.04] text-center font-mono text-xl font-semibold text-white outline-none transition-all duration-200 ${
                error
                  ? "animate-[shake_0.4s_ease-in-out] border-red-400/50 bg-red-400/[0.06]"
                  : digit
                    ? "border-white/22 bg-white/[0.08]"
                    : "border-white/10 focus:border-white/30 focus:bg-white/[0.06]"
              }`}
              style={{ caretColor: "transparent" }}
            />
          ))}
        </div>

        {error && (
          <div className="mt-3 text-center text-[12px] text-red-400/80">
            Incorrect PIN
          </div>
        )}

        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/8 bg-white/[0.03] px-6 py-2.5 text-[13px] font-semibold text-white/68 transition-colors duration-200 hover:border-white/14 hover:bg-white/[0.06] hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface CloudSwooshButtonProps {
  active: boolean;
  cleared: boolean;
  swooshTick: number;
  onClick: () => void;
}

function CloudSwooshButton({
  active,
  cleared,
  swooshTick,
  onClick,
}: CloudSwooshButtonProps) {
  const label = cleared ? "Clouds cleared" : "Swoosh clouds away";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cleared}
      aria-label={label}
      title={label}
      className={`cloud-swoosh-trigger group relative flex h-11 w-11 items-center justify-center rounded-[18px] border text-white/72 shadow-[0_10px_24px_rgba(7,18,28,0.14),inset_0_1px_0_rgba(255,255,255,0.08)] transition-[transform,border-color,background-color,color,box-shadow] duration-300 active:scale-[0.985] disabled:cursor-default ${
        active || cleared
          ? "border-white/16 bg-[rgba(255,255,255,0.065)] text-white/82 shadow-[0_12px_28px_rgba(7,18,28,0.16),inset_0_1px_0_rgba(255,255,255,0.1)]"
          : "border-white/8 bg-[rgba(255,255,255,0.025)] hover:-translate-y-px hover:border-white/14 hover:bg-[rgba(255,255,255,0.045)] hover:text-white/88 hover:shadow-[0_12px_28px_rgba(7,18,28,0.18),inset_0_1px_0_rgba(255,255,255,0.1)]"
      }`}
    >
      <span
        className={`pointer-events-none absolute inset-[5px] rounded-[14px] bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.12),rgba(255,255,255,0)_68%)] transition-opacity duration-300 ${
          active || cleared
            ? "opacity-100"
            : "opacity-[0.45] group-hover:opacity-[0.8]"
        }`}
      />
      <span
        key={swooshTick}
        className={`cloud-swoosh-icon-wrap relative flex h-5 w-5 items-center justify-center ${
          active ? "is-active" : ""
        }`}
      >
        <HugeiconsIcon
          icon={WavingHand01Icon}
          altIcon={WavingHand02Icon}
          showAlt={active}
          size={18}
          strokeWidth={1.6}
          color="currentColor"
          className="cloud-swoosh-icon"
        />
      </span>
    </button>
  );
}

interface ModeButtonProps {
  active: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}

function ModeButton({ active, disabled, label, onClick }: ModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-[22px] px-7 py-3 text-[15px] font-semibold tracking-[-0.02em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? "bg-[rgba(255,255,255,0.14)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "text-white/68 hover:text-white/88"
      }`}
    >
      {label}
    </button>
  );
}
