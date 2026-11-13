import { isServerMessage, type GiftMessage, type ServerMessage, type StatusMessage } from "../shared.js";
import { ThreeGiftStage } from "./three-stage.js";

const params = new URLSearchParams(window.location.search);
const key = params.get("key");
const statusElement = document.querySelector<HTMLElement>("#connection-status");
const scoreElement = document.querySelector<HTMLElement>("#score");
const eventElement = document.querySelector<HTMLElement>("#gift-event");
const giftNameElement = document.querySelector<HTMLElement>("#gift-name");
const giftSenderElement = document.querySelector<HTMLElement>("#gift-sender");
const activityList = document.querySelector<HTMLElement>("#activity-list");
const effectsElement = document.querySelector<HTMLElement>("#effects");
const stageElement = document.querySelector<HTMLElement>("#stage");

if (
  !statusElement ||
  !scoreElement ||
  !eventElement ||
  !giftNameElement ||
  !giftSenderElement ||
  !activityList ||
  !effectsElement ||
  !stageElement
) {
  throw new Error("Overlay page is missing required elements.");
}

const elements = {
  statusElement,
  scoreElement,
  eventElement,
  giftNameElement,
  giftSenderElement,
  activityList,
  effectsElement,
  stageElement,
};

const threeStage = new ThreeGiftStage(elements.stageElement);

let score = 0;
let socket: WebSocket | null = null;

function connect(): void {
  if (!key) {
    showStatus("ลิงก์ Overlay ไม่ถูกต้อง");
    return;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(
    `${protocol}//${window.location.host}/events?key=${encodeURIComponent(key)}`,
  );

  socket.addEventListener("open", () => {
    elements.statusElement.textContent = "LIVE";
    elements.statusElement.dataset.state = "connected";
  });

  socket.addEventListener("message", (event) => {
    const message: unknown = JSON.parse(String(event.data));
    if (!isServerMessage(message)) {
      return;
    }
    handleMessage(message);
  });

  socket.addEventListener("close", () => {
    showStatus("กำลังเชื่อมต่อใหม่...");
    window.setTimeout(connect, 2000);
  });

  socket.addEventListener("error", () => {
    socket?.close();
  });
}

function handleMessage(message: ServerMessage): void {
  if (message.type === "status") {
    handleStatus(message);
    return;
  }

  handleGift(message);
}

function handleStatus(status: StatusMessage): void {
  if (status.state === "connected") {
    elements.statusElement.textContent = "LIVE";
    elements.statusElement.dataset.state = "connected";
  } else if (status.state === "connecting") {
    showStatus("กำลังเชื่อมต่อ TikTok...");
  } else if (status.state === "error") {
    showStatus("TikTok Connector มีปัญหา");
  } else {
    showStatus("รอ TikTok LIVE");
  }
}

function handleGift(gift: GiftMessage): void {
  threeStage.onGift(gift);
  const count = Math.max(1, Math.min(gift.repeatCount, 100));
  const diamonds = Math.max(0, gift.diamonds);
  score += Math.max(1, diamonds) * count;
  elements.scoreElement.textContent = score.toLocaleString();
  elements.giftNameElement.textContent = `${gift.giftName} x${count}`;
  elements.giftSenderElement.textContent = gift.userName;

  const isBigGift = diamonds >= 100;
  const isRose = /rose|flower|ดอกกุหลาบ|กุหลาบ/i.test(`${gift.giftName} ${gift.giftId}`);
  elements.eventElement.textContent = isBigGift
    ? "MEGA GIFT!"
    : isRose
      ? "ดอกไม้เต็มเวที!"
      : "ขอบคุณสำหรับ Gift!";

  elements.eventElement.classList.remove("pop");
  void elements.eventElement.offsetWidth;
  elements.eventElement.classList.add("pop");
  elements.stageElement.classList.toggle("celebrate", isBigGift);
  window.setTimeout(() => elements.stageElement.classList.remove("celebrate"), 900);

  for (let index = 0; index < Math.min(count, 12); index++) {
    spawnEffect(isRose ? "🌹" : isBigGift ? "✨" : "💖");
  }
  addActivity(gift);
}

function spawnEffect(icon: string): void {
  const particle = document.createElement("span");
  particle.className = "particle";
  particle.textContent = icon;
  particle.style.left = `${10 + Math.random() * 80}%`;
  particle.style.setProperty("--drift", `${(Math.random() - 0.5) * 180}px`);
  elements.effectsElement.append(particle);
  particle.addEventListener("animationend", () => particle.remove(), { once: true });
}

function addActivity(gift: GiftMessage): void {
  const item = document.createElement("li");
  item.textContent = `${gift.userName} · ${gift.giftName} x${gift.repeatCount}`;
  elements.activityList.prepend(item);
  while (elements.activityList.children.length > 4) {
    elements.activityList.lastElementChild?.remove();
  }
}

function showStatus(message: string): void {
  elements.statusElement.textContent = message;
  elements.statusElement.dataset.state = "waiting";
}

connect();
