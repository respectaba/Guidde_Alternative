/**
 * Background service worker: owns recording state, takes screenshots with
 * chrome.tabs.captureVisibleTab (rate-limited, so captures are queued), builds
 * Step objects with heuristic captions, and on Stop POSTs the assembled guide
 * to the web app and opens the editor.
 */
import type { Step } from "@guide/shared/types";
import { generateCaption } from "@guide/shared/captions";
import {
  getApiBase,
  type RuntimeMessage,
  type StateResponse,
  type StopResponse,
} from "./lib/messaging";

interface Session {
  recording: boolean;
  buffer: Step[];
}

let session: Session = { recording: false, buffer: [] };

// Restore state across service-worker restarts.
chrome.storage.session.get("session").then((v) => {
  if (v.session) session = v.session as Session;
  updateBadge();
});

function persist() {
  void chrome.storage.session.set({ session });
}

function updateBadge() {
  const text = session.recording ? String(session.buffer.length) : "";
  void chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
  void chrome.action.setBadgeText({ text });
}

// ---- Screenshot capture queue (captureVisibleTab is ~1/sec rate-limited) ----
let queue: Promise<void> = Promise.resolve();
let lastCapture = 0;

function enqueueCapture(task: () => Promise<void>) {
  queue = queue.then(async () => {
    const since = Date.now() - lastCapture;
    if (since < 600) await new Promise((r) => setTimeout(r, 600 - since));
    try {
      await task();
    } catch (e) {
      console.error("capture failed", e);
    }
    lastCapture = Date.now();
  });
}

async function captureStep(
  windowId: number | undefined,
  msg: Extract<RuntimeMessage, { type: "CAPTURE_STEP" }>,
) {
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId as number, {
    format: "jpeg",
    quality: 80,
  });
  const order = session.buffer.length;
  const step: Step = {
    id: crypto.randomUUID(),
    order,
    screenshot: dataUrl,
    viewport: msg.viewport,
    click: msg.click,
    caption: generateCaption(msg.element),
    element: msg.element,
    annotations: [],
    blurRegions: [],
  };
  session.buffer.push(step);
  persist();
  updateBadge();
}

async function submitGuide(): Promise<StopResponse> {
  if (session.buffer.length === 0) {
    return { ok: false, error: "No steps captured." };
  }
  const base = await getApiBase();
  const title = `Captured guide — ${new Date().toLocaleString()}`;
  try {
    const res = await fetch(`${base}/api/guides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, steps: session.buffer }),
    });
    if (!res.ok) {
      return { ok: false, error: `Server responded ${res.status}` };
    }
    const data = (await res.json()) as { id: string };
    const editorUrl = `${base}/editor/${data.id}`;
    await chrome.tabs.create({ url: editorUrl });
    return { ok: true, id: data.id, editorUrl };
  } catch (e) {
    return { ok: false, error: `Could not reach ${base}. Is the web app running?` };
  }
}

function broadcast(type: "START_RECORDING" | "STOP_RECORDING") {
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs) {
      if (t.id != null) chrome.tabs.sendMessage(t.id, { type }, () => void chrome.runtime.lastError);
    }
  });
}

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, sender, sendResponse) => {
  switch (msg.type) {
    case "GET_STATE": {
      const res: StateResponse = { recording: session.recording, count: session.buffer.length };
      sendResponse(res);
      return false;
    }
    case "START_RECORDING": {
      session = { recording: true, buffer: [] };
      persist();
      updateBadge();
      broadcast("START_RECORDING");
      sendResponse({ ok: true });
      return false;
    }
    case "STOP_RECORDING": {
      session.recording = false;
      persist();
      updateBadge();
      broadcast("STOP_RECORDING");
      // Wait for any in-flight captures to finish, then submit.
      queue.then(async () => {
        const result = await submitGuide();
        session = { recording: false, buffer: [] };
        persist();
        updateBadge();
        sendResponse(result);
      });
      return true; // async response
    }
    case "CAPTURE_STEP": {
      if (session.recording) {
        enqueueCapture(() => captureStep(sender.tab?.windowId, msg));
      }
      return false;
    }
  }
});
