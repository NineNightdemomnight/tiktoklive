import { isServerMessage, type ServerMessage, type StatusMessage } from "../shared.js";

declare global {
  interface Window {
    liveControlKey: string;
  }
}

const usernameInput = document.querySelector<HTMLInputElement>("#username");
const connectButton = document.querySelector<HTMLButtonElement>("#connect");
const disconnectButton = document.querySelector<HTMLButtonElement>("#disconnect");
const testGiftButton = document.querySelector<HTMLButtonElement>("#test-gift");
const statusMessage = document.querySelector<HTMLElement>("#status-message");
const statusBadge = document.querySelector<HTMLElement>("#status-badge");
const overlayUrl = document.querySelector<HTMLInputElement>("#overlay-url");
const copyButton = document.querySelector<HTMLButtonElement>("#copy-url");
const eventList = document.querySelector<HTMLElement>("#recent-events");

if (
  !usernameInput ||
  !connectButton ||
  !disconnectButton ||
  !testGiftButton ||
  !statusMessage ||
  !statusBadge ||
  !overlayUrl ||
  !copyButton ||
  !eventList
) {
  throw new Error("Control page is missing required elements.");
}

const elements = {
  usernameInput,
  connectButton,
  disconnectButton,
  testGiftButton,
  statusMessage,
  statusBadge,
  overlayUrl,
  copyButton,
  eventList,
};

elements.overlayUrl.value =
  `${window.location.origin}/overlay?key=${encodeURIComponent(window.liveControlKey)}`;

elements.connectButton.addEventListener("click", () => {
  void post("/api/connect", { username: elements.usernameInput.value });
});

elements.disconnectButton.addEventListener("click", () => {
  void post("/api/disconnect");
});

elements.testGiftButton.addEventListener("click", () => {
  void post("/api/test-gift");
});

elements.copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(elements.overlayUrl.value);
    elements.copyButton.textContent = "คัดลอกแล้ว";
    window.setTimeout(() => {
      elements.copyButton.textContent = "คัดลอก URL";
    }, 1500);
  } catch {
    elements.overlayUrl.select();
    document.execCommand("copy");
  }
});

function openSocket(): void {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(
    `${protocol}//${window.location.host}/events?key=${encodeURIComponent(window.liveControlKey)}`,
  );

  socket.addEventListener("message", (event) => {
    const message: unknown = JSON.parse(String(event.data));
    if (!isServerMessage(message)) {
      return;
    }
    handleMessage(message);
  });

  socket.addEventListener("close", () => {
    window.setTimeout(openSocket, 2000);
  });
}

function handleMessage(message: ServerMessage): void {
  if (message.type === "status") {
    renderStatus(message);
    return;
  }

  addEvent(message);
}

function renderStatus(status: StatusMessage): void {
  elements.statusMessage.textContent = status.message;
  elements.statusBadge.textContent = status.state.toUpperCase();
  elements.statusBadge.dataset.state = status.state;
  elements.connectButton.disabled = status.state === "connecting";
  elements.disconnectButton.disabled =
    status.state === "disconnected" || status.state === "error";
}

function addEvent(message: Extract<ServerMessage, { type: "gift" }>): void {
  const item = document.createElement("li");
  item.textContent = `${message.userName} ส่ง ${message.giftName} x${message.repeatCount}`;
  elements.eventList.prepend(item);
  while (elements.eventList.children.length > 5) {
    elements.eventList.lastElementChild?.remove();
  }
}

async function post(path: string, body?: Record<string, string>): Promise<void> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-live-control-key": window.liveControlKey,
      },
      body: body ? JSON.stringify(body) : "{}",
    });

    const result: unknown = await response.json();
    if (!response.ok) {
      const message =
        typeof result === "object" && result !== null && "error" in result
          ? String(result.error)
          : "Request failed";
      elements.statusMessage.textContent = message;
    }
  } catch (error) {
    elements.statusMessage.textContent =
      error instanceof Error ? error.message : "ไม่สามารถติดต่อเซิร์ฟเวอร์ได้";
  }
}

openSocket();
