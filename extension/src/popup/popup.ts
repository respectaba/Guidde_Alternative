import {
  DEFAULT_API_BASE,
  type RuntimeMessage,
  type StateResponse,
  type StopResponse,
} from "../lib/messaging";

const countEl = document.getElementById("count")!;
const countLabel = document.getElementById("countLabel")!;
const toggleBtn = document.getElementById("toggle") as HTMLButtonElement;
const apiBaseInput = document.getElementById("apiBase") as HTMLInputElement;
const statusEl = document.getElementById("status")!;

let recording = false;

function send<T = unknown>(msg: RuntimeMessage): Promise<T> {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function render() {
  if (recording) {
    toggleBtn.textContent = "■ Stop & save";
    toggleBtn.className = "stop";
    countLabel.innerHTML = '<span class="dot"></span>recording…';
  } else {
    toggleBtn.textContent = "● Start recording";
    toggleBtn.className = "start";
    countLabel.textContent = "steps captured";
  }
}

async function refresh() {
  const state = await send<StateResponse>({ type: "GET_STATE" });
  if (state) {
    recording = state.recording;
    countEl.textContent = String(state.count);
    render();
  }
}

// Load saved API base.
chrome.storage.local.get("apiBase").then(({ apiBase }) => {
  apiBaseInput.value = (apiBase as string) || DEFAULT_API_BASE;
});
apiBaseInput.addEventListener("change", () => {
  void chrome.storage.local.set({ apiBase: apiBaseInput.value.trim().replace(/\/$/, "") });
});

toggleBtn.addEventListener("click", async () => {
  statusEl.textContent = "";
  if (!recording) {
    await send({ type: "START_RECORDING" });
    recording = true;
    countEl.textContent = "0";
    render();
    statusEl.textContent = "Recording. Click through your workflow, then Stop.";
  } else {
    toggleBtn.disabled = true;
    statusEl.textContent = "Saving guide…";
    const res = await send<StopResponse>({ type: "STOP_RECORDING" });
    toggleBtn.disabled = false;
    recording = false;
    render();
    if (res?.ok && res.editorUrl) {
      statusEl.innerHTML = `Saved! <a href="${res.editorUrl}" target="_blank">Open editor →</a>`;
    } else {
      statusEl.innerHTML = `<span class="err">${res?.error ?? "Failed to save."}</span>`;
    }
  }
});

// Poll while open so the count updates live.
setInterval(refresh, 700);
void refresh();
