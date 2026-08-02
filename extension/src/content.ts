/**
 * Content script: listens for clicks on any page while recording and reports
 * the click point + element metadata to the background worker, which takes the
 * screenshot. Capture is triggered on `mousedown` (capture phase) so the frame
 * is grabbed BEFORE a click navigates or mutates the page.
 */
import type { RuntimeMessage, StateResponse } from "./lib/messaging";
import { describeElement } from "./lib/selector";

let recording = false;

// Sync initial state (the page may load mid-recording).
chrome.runtime.sendMessage({ type: "GET_STATE" } satisfies RuntimeMessage, (res?: StateResponse) => {
  if (chrome.runtime.lastError) return;
  if (res) recording = res.recording;
});

// React to start/stop broadcasts.
chrome.runtime.onMessage.addListener((msg: RuntimeMessage) => {
  if (msg.type === "START_RECORDING") recording = true;
  if (msg.type === "STOP_RECORDING") recording = false;
});

window.addEventListener(
  "mousedown",
  (e) => {
    if (!recording) return;
    if (e.button !== 0) return; // left click only
    const target = (e.target as Element) ?? document.body;
    if (!target || target.nodeType !== 1) return;

    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;

    const message: RuntimeMessage = {
      type: "CAPTURE_STEP",
      click: { x: e.clientX / vw, y: e.clientY / vh },
      viewport: { w: vw, h: vh, dpr: window.devicePixelRatio || 1 },
      element: describeElement(target),
    };

    // Fire-and-forget; the background debounces captureVisibleTab.
    chrome.runtime.sendMessage(message, () => void chrome.runtime.lastError);
  },
  true, // capture phase — runs before the page's own click handlers
);
