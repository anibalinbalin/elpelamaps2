"use client";

import { Moon02Icon, Sun03Icon, WavingHand01Icon, WavingHand02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { EditorAccessDialog } from "./editor-access-dialog";
import { grantEditorAccess, hasEditorAccess } from "@/lib/editor-access";

interface TopBarProps {
  drawMode: boolean;
  parcelCount: number;
  cloudSwooshTick: number;
  cloudsCleared: boolean;
  isCloudSwooshing: boolean;
  onSwooshClouds: () => void;
  isNightMode?: boolean;
  onToggleNightMode?: () => void;
}

export function TopBar({
  drawMode,
  parcelCount,
  cloudSwooshTick,
  cloudsCleared,
  isCloudSwooshing,
  onSwooshClouds,
  isNightMode,
  onToggleNightMode,
}: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showEditorAccessDialog, setShowEditorAccessDialog] = useState(false);

  function handleViewerClick() {
    if (!drawMode || isPending) {
      return;
    }

    startTransition(() => {
      router.push(pathname);
    });
  }

  function handleEditorClick() {
    if (isPending) {
      return;
    }

    if (hasEditorAccess()) {
      startTransition(() => {
        router.push("/editor");
      });
      return;
    }

    setShowEditorAccessDialog(true);
  }

  function handleEditorAccessSuccess() {
    grantEditorAccess();
    setShowEditorAccessDialog(false);
    startTransition(() => {
      router.push("/editor");
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
              onClick={handleViewerClick}
            />
            <ModeButton
              active={false}
              disabled={isPending}
              label="Editor"
              onClick={handleEditorClick}
            />
            <div className="mx-1 h-8 w-px bg-white/10" />
            <CloudSwooshButton
              active={isCloudSwooshing}
              cleared={cloudsCleared}
              swooshTick={cloudSwooshTick}
              onClick={onSwooshClouds}
            />
            {onToggleNightMode && (
              <>
                <div className="mx-1 h-8 w-px bg-white/10" />
                <button
                  type="button"
                  onClick={onToggleNightMode}
                  aria-label={isNightMode ? "Switch to day" : "Switch to night"}
                  title={isNightMode ? "Switch to day" : "Switch to night"}
                  className={`group relative flex h-11 w-11 items-center justify-center rounded-[18px] border text-white/72 shadow-[0_10px_24px_rgba(7,18,28,0.14),inset_0_1px_0_rgba(255,255,255,0.08)] transition-[transform,border-color,background-color,color,box-shadow] duration-300 active:scale-[0.985] ${
                    isNightMode
                      ? "border-amber-400/30 bg-[rgba(255,200,60,0.12)] text-amber-200/90 shadow-[0_12px_28px_rgba(7,18,28,0.16),inset_0_1px_0_rgba(255,255,255,0.1)]"
                      : "border-white/8 bg-[rgba(255,255,255,0.025)] hover:-translate-y-px hover:border-white/14 hover:bg-[rgba(255,255,255,0.045)] hover:text-white/88 hover:shadow-[0_12px_28px_rgba(7,18,28,0.18),inset_0_1px_0_rgba(255,255,255,0.1)]"
                  }`}
                >
                  <span
                    className={`pointer-events-none absolute inset-[5px] rounded-[14px] bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.12),rgba(255,255,255,0)_68%)] transition-opacity duration-300 ${
                      isNightMode
                        ? "opacity-100"
                        : "opacity-[0.45] group-hover:opacity-[0.8]"
                    }`}
                  />
                  <HugeiconsIcon
                    icon={isNightMode ? Sun03Icon : Moon02Icon}
                    size={18}
                    strokeWidth={1.6}
                    color="currentColor"
                  />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="rounded-full border border-white/20 bg-[#0f2741]/18 px-3 py-1 text-[11px] text-white/76 shadow-[0_10px_30px_rgba(6,22,39,0.12)] backdrop-blur-md">
          {parcelCount} Parcels
        </div>
      </div>

      {showEditorAccessDialog && (
        <EditorAccessDialog
          onSuccess={handleEditorAccessSuccess}
          onCancel={() => setShowEditorAccessDialog(false)}
        />
      )}
    </>
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
