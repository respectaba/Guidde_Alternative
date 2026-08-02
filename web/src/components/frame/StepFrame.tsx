"use client";
import type { ReactNode } from "react";
import type { Step } from "@guide/shared";
import { useElementSize } from "@/lib/useElementSize";
import { AnnotationLayer } from "./AnnotationLayer";
import { BlurLayer } from "./BlurLayer";
import { ClickPing } from "../playback/ClickPing";

/**
 * The canonical rendering of one step: screenshot + blur regions + annotations +
 * optional click marker, layered and sized to the displayed image. Read-only by
 * default; the editor passes `overlay` to add its interactive layer on top.
 *
 * When `zoomActive` is set, the whole frame runs a Ken-Burns zoom toward the
 * click point (playback only). Remount the component (key by step id) to restart
 * the animation per step.
 */
export function StepFrame({
  step,
  showClick = true,
  animateClick = false,
  selectedId,
  overlay,
  rounded = true,
  zoomActive = false,
}: {
  step: Step;
  showClick?: boolean;
  animateClick?: boolean;
  selectedId?: string | null;
  /** Interactive layer rendered above everything (editor only). */
  overlay?: (size: { width: number; height: number }) => ReactNode;
  rounded?: boolean;
  /** Run the cinematic zoom toward the click point (playback). */
  zoomActive?: boolean;
}) {
  const { ref, size } = useElementSize<HTMLDivElement>();

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: "100%",
        lineHeight: 0,
        borderRadius: rounded ? 12 : 0,
        overflow: "hidden",
        background: "#0b0f1a",
      }}
    >
      <div
        className={zoomActive ? "sf-kenburns" : undefined}
        style={{
          position: "relative",
          transformOrigin: `${step.click.x * 100}% ${step.click.y * 100}%`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={step.screenshot}
          alt={step.caption}
          style={{ width: "100%", height: "auto", display: "block" }}
          draggable={false}
        />
        <BlurLayer regions={step.blurRegions} size={size} />
        <AnnotationLayer
          annotations={step.annotations}
          size={size}
          selectedId={selectedId}
        />
        {showClick && (
          <ClickPing point={step.click} size={size} animate={animateClick} />
        )}
        {overlay?.(size)}
      </div>
    </div>
  );
}
