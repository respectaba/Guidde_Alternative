/**
 * Typed message contracts between the content script, background service worker,
 * and popup. Screenshots are taken in the background (content scripts can't call
 * captureVisibleTab), so the content script only sends click + element metadata.
 */
import type { ElementMeta, Point, Viewport } from "@guide/shared/types";

export interface CaptureStepMessage {
  type: "CAPTURE_STEP";
  click: Point;
  viewport: Viewport;
  element: ElementMeta;
}

export interface StartRecordingMessage {
  type: "START_RECORDING";
}
export interface StopRecordingMessage {
  type: "STOP_RECORDING";
}
export interface GetStateMessage {
  type: "GET_STATE";
}

export type RuntimeMessage =
  | CaptureStepMessage
  | StartRecordingMessage
  | StopRecordingMessage
  | GetStateMessage;

export interface StateResponse {
  recording: boolean;
  count: number;
}

export interface StopResponse {
  ok: boolean;
  id?: string;
  editorUrl?: string;
  error?: string;
}

export const DEFAULT_API_BASE = "http://localhost:3000";

/** postMessage contract for one-click "Connect extension" from the web app. */
export const CONNECT_REQUEST = "GUIDEFLOW_CONNECT";
export const CONNECT_ACK = "GUIDEFLOW_CONNECTED";
export interface ConnectRequest {
  source: "guideflow-app";
  type: typeof CONNECT_REQUEST;
  apiBase: string;
  token: string;
}

export async function getApiBase(): Promise<string> {
  const { apiBase } = await chrome.storage.local.get("apiBase");
  return (apiBase as string) || DEFAULT_API_BASE;
}

export async function getApiToken(): Promise<string> {
  const { apiToken } = await chrome.storage.local.get("apiToken");
  return (apiToken as string) || "";
}
