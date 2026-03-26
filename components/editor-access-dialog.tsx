"use client";

import { useEffect, useRef, useState } from "react";
import { EDITOR_PIN } from "@/lib/editor-access";

export function EditorAccessDialog({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const pinLength = 4;
  const [digits, setDigits] = useState<string[]>(Array(pinLength).fill(""));
  const [error, setError] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  function trySubmit(nextDigits: string[]) {
    const code = nextDigits.join("");
    if (code.length !== pinLength) {
      return;
    }

    if (code === EDITOR_PIN) {
      onSuccess();
      return;
    }

    setError(true);
    setDigits(Array(pinLength).fill(""));
    window.setTimeout(() => inputRefs.current[0]?.focus(), 60);
  }

  function handleChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError(false);

    if (digit && index < pinLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    trySubmit(next);
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
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
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowRight" && index < pinLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent) {
    event.preventDefault();

    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, pinLength);
    if (!pasted) {
      return;
    }

    const next = Array(pinLength).fill("");
    for (let index = 0; index < pasted.length; index += 1) {
      next[index] = pasted[index];
    }

    setDigits(next);
    setError(false);
    inputRefs.current[Math.min(pasted.length, pinLength - 1)]?.focus();
    trySubmit(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[30dvh]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-[340px] rounded-2xl border border-white/12 bg-[rgba(18,24,32,0.92)] p-6 shadow-[0_32px_80px_rgba(4,16,28,0.4)] backdrop-blur-xl">
        <div className="mb-6 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/42">
            Editor Access
          </div>
          <div className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em] text-white">
            Enter PIN
          </div>
        </div>

        <div className="flex justify-center gap-3" onPaste={handlePaste}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => { inputRefs.current[index] = element; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(event) => handleChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
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
