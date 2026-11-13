import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  ControlEvent,
  WebcastEvent,
} from "tiktok-live-connector";
import { WebcastPushConnection } from "tiktok-live-connector/legacy";
import { WebSocket, WebSocketServer } from "ws";
import type { GiftMessage, ServerMessage, StatusMessage } from "./shared.js";

const host =
  process.env.HOST ?? (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const port = Number(process.env.PORT ?? 3000);
const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));
const controlKey = loadControlKey();
const controlPassword = process.env.CONTROL_PASSWORD;

if (process.env.NODE_ENV === "production" && !controlPassword) {
  throw new Error("CONTROL_PASSWORD must be set when NODE_ENV=production.");
}

let activeConnection: WebcastPushConnection | null = null;
let connectionGeneration = 0;
let currentStatus: StatusMessage = {
  type: "status",
  state: "disconnected",
  username: "",
  message: "ยังไม่ได้เชื่อมต่อ",
};

const server = createServer((request, response) => {
  void handleHttpRequest(request, response).catch((error: unknown) => {
    console.error("Request failed:", error);
    if (!response.headersSent) {
      sendJson(response, 500, { error: "Internal server error" });
    } else {
      response.destroy();
    }
  });
});

const webSocketServer = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (url.pathname !== "/events" || url.searchParams.get("key") !== controlKey) {
    socket.destroy();
    return;
  }

  webSocketServer.handleUpgrade(request, socket, head, (client) => {
    webSocketServer.emit("connection", client, request);
  });
});

webSocketServer.on("connection", (client) => {
  client.send(JSON.stringify(currentStatus));
});

server.listen(port, host, () => {
  const origin = (process.env.RENDER_EXTERNAL_URL ?? `http://127.0.0.1:${port}`).replace(/\/$/, "");
  console.log(`Control panel: ${origin}/`);
  console.log(`TikTok LIVE Studio overlay URL: ${origin}/overlay?key=${encodeURIComponent(controlKey)}`);
  console.log("Enter the TikTok LIVE username in the control panel to connect.");
});

async function handleHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);

  if (
    url.pathname === "/" ||
    url.pathname === "/control" ||
    url.pathname === "/assets/control.js" ||
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/")
  ) {
    if (!requireControlAuthorization(request, response)) {
      return;
    }
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/control")) {
    const html = await readFile(`${publicDirectory}control.html`, "utf8");
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html.replaceAll("__CONTROL_KEY__", controlKey));
    return;
  }

  if (request.method === "GET" && url.pathname === "/overlay") {
    if (url.searchParams.get("key") !== controlKey) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("Overlay link is invalid. Copy the current URL from the control panel.");
      return;
    }

    await sendFile(response, `${publicDirectory}overlay.html`, "text/html; charset=utf-8");
    return;
  }

  if (request.method === "GET" && url.pathname === "/assets/control.js") {
    await sendFile(response, `${publicDirectory}assets/control.js`, "text/javascript; charset=utf-8");
    return;
  }

  if (request.method === "GET" && url.pathname === "/assets/overlay.js") {
    await sendFile(response, `${publicDirectory}assets/overlay.js`, "text/javascript; charset=utf-8");
    return;
  }

  if (request.method === "GET" && url.pathname === "/styles.css") {
    await sendFile(response, `${publicDirectory}styles.css`, "text/css; charset=utf-8");
    return;
  }

  if (request.method === "GET" && url.pathname === "/images/festival-stage.png") {
    await sendFile(response, `${publicDirectory}images/festival-stage.png`, "image/png");
    return;
  }

  if (url.pathname.startsWith("/api/") && !hasControlKey(request)) {
    sendJson(response, 403, { error: "Invalid control key" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/status") {
    sendJson(response, 200, currentStatus);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/connect") {
    const body = await readJsonBody(request);
    const username = normalizeUsername(body.username);
    if (!username) {
      sendJson(response, 400, {
        error: "ใส่ Username หรือ URL LIVE ของ TikTok ให้ถูกต้อง",
      });
      return;
    }

    void connectToTikTok(username);
    sendJson(response, 202, { ok: true, message: "กำลังเชื่อมต่อ" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/disconnect") {
    await disconnectFromTikTok();
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/test-gift") {
    publish({
      type: "gift",
      id: randomUUID(),
      userName: "Test Viewer",
      giftId: "rose",
      giftName: "Rose",
      repeatCount: 1,
      diamonds: 1,
      timestamp: Date.now(),
    });
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true, state: currentStatus.state });
    return;
  }

  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

async function connectToTikTok(username: string): Promise<void> {
  const generation = ++connectionGeneration;
  const previousConnection = activeConnection;
  activeConnection = null;
  let newConnection: WebcastPushConnection | null = null;

  try {
    if (previousConnection) {
      await previousConnection.disconnect();
    }

    if (generation !== connectionGeneration) {
      return;
    }

    const connection = new WebcastPushConnection(username, {});
    newConnection = connection;
    activeConnection = connection;
    setStatus("connecting", username, `กำลังเชื่อมต่อกับ @${username}`);

    connection.on(ControlEvent.ERROR, (error: unknown) => {
      const errorRecord = asRecord(error);
      const exception = errorRecord?.exception;
      const info = errorRecord?.info;
      const detail =
        exception instanceof Error
          ? exception.message
          : String(info ?? error ?? "Unknown error");
      console.error(`TikTok connector error for @${username}:`, error);
      if (activeConnection === connection) {
        setStatus("error", username, detail);
      }
    });

    connection.on(ControlEvent.DISCONNECTED, () => {
      if (activeConnection === connection) {
        activeConnection = null;
        setStatus("disconnected", username, `ตัดการเชื่อมต่อจาก @${username}`);
      }
    });

    connection.on(WebcastEvent.GIFT, (rawEvent: unknown) => {
      if (activeConnection !== connection) {
        return;
      }

      const event = asRecord(rawEvent);
      if (!event || event.giftId === undefined || event.giftId === null) {
        return;
      }

      const giftMetadata = asRecord(event.gift);
      const giftType = Number(giftMetadata?.gift_type ?? giftMetadata?.type);
      const repeatEnd = event.repeatEnd === true || event.repeatEnd === 1;
      if (giftType === 1 && !repeatEnd) {
        return;
      }

      const repeatCount = Math.max(1, Number(event.repeatCount ?? 1));
      const diamonds = Math.max(0, Number(event.diamondCount ?? 0));
      const extendedGiftInfo = asRecord(event.extendedGiftInfo);
      const gift: GiftMessage = {
        type: "gift",
        id: randomUUID(),
        userName: String(event.uniqueId ?? event.nickname ?? "ผู้ชม"),
        giftId: String(event.giftId),
        giftName: String(event.giftName ?? extendedGiftInfo?.name ?? `Gift ${event.giftId}`),
        repeatCount: Number.isFinite(repeatCount) ? repeatCount : 1,
        diamonds: Number.isFinite(diamonds) ? diamonds : 0,
        timestamp: Date.now(),
      };

      publish(gift);
    });

    await connection.connect();
    if (generation === connectionGeneration && activeConnection === connection) {
      setStatus("connected", username, `เชื่อมต่อ LIVE @${username} แล้ว`);
    } else {
      await connection.disconnect();
    }
  } catch (error) {
    if (newConnection && activeConnection === newConnection) {
      activeConnection = null;
    }
    if (generation === connectionGeneration) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Could not connect to @${username}:`, error);
      setStatus("error", username, message);
    }
  }
}

async function disconnectFromTikTok(): Promise<void> {
  connectionGeneration++;
  const connection = activeConnection;
  activeConnection = null;
  if (connection) {
    await connection.disconnect();
  }
  setStatus("disconnected", "", "ตัดการเชื่อมต่อแล้ว");
}

function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  let username = value.trim();
  const liveUrlMatch = username.match(/^https?:\/\/(?:www\.)?tiktok\.com\/@([^/?#]+)/i);
  if (liveUrlMatch) {
    username = liveUrlMatch[1];
  }

  username = username.replace(/^@/, "");
  return /^[A-Za-z0-9._]{2,24}$/.test(username) ? username : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function loadControlKey(): string {
  const configuredKey = process.env.OVERLAY_KEY;
  if (configuredKey !== undefined) {
    if (!/^[A-Za-z0-9+/_=-]{32,128}$/.test(configuredKey)) {
      throw new Error("OVERLAY_KEY must be 32-128 URL-safe characters.");
    }
    return configuredKey;
  }

  const keyPath = new URL("../.overlay-key", import.meta.url);
  if (existsSync(keyPath)) {
    const savedKey = readFileSync(keyPath, "utf8").trim();
    if (/^[a-f0-9]{48}$/.test(savedKey)) {
      return savedKey;
    }
    throw new Error("The .overlay-key file is invalid. Remove it and restart the server.");
  }

  const newKey = randomBytes(24).toString("hex");
  writeFileSync(keyPath, newKey, { flag: "wx" });
  return newKey;
}

function setStatus(
  state: StatusMessage["state"],
  username: string,
  message: string,
): void {
  currentStatus = { type: "status", state, username, message };
  publish(currentStatus);
}

function publish(message: ServerMessage): void {
  const serialized = JSON.stringify(message);
  for (const client of webSocketServer.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  }
}

function hasControlKey(request: IncomingMessage): boolean {
  return request.headers["x-live-control-key"] === controlKey;
}

function requireControlAuthorization(
  request: IncomingMessage,
  response: ServerResponse,
): boolean {
  if (!controlPassword || hasControlAuthorization(request)) {
    return true;
  }

  response.writeHead(401, {
    "content-type": "text/plain; charset=utf-8",
    "www-authenticate": 'Basic realm="TikLive Control", charset="UTF-8"',
  });
  response.end("Sign in to access the control panel.");
  return false;
}

function hasControlAuthorization(request: IncomingMessage): boolean {
  const authorization = request.headers.authorization;
  if (!controlPassword || !authorization?.startsWith("Basic ")) {
    return false;
  }

  const credentials = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  const separator = credentials.indexOf(":");
  if (separator < 0 || credentials.slice(0, separator) !== "admin") {
    return false;
  }

  const providedPassword = Buffer.from(credentials.slice(separator + 1), "utf8");
  const expectedPassword = Buffer.from(controlPassword, "utf8");
  return (
    providedPassword.length === expectedPassword.length &&
    timingSafeEqual(providedPassword, expectedPassword)
  );
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function sendFile(
  response: ServerResponse,
  path: string,
  contentType: string,
): Promise<void> {
  try {
    const content = await readFile(path);
    response.writeHead(200, { "content-type": contentType });
    response.end(content);
  } catch (error) {
    console.error(`Could not read ${path}:`, error);
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("File not found. Run the build command first.");
  }
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > 8192) {
      throw new Error("Request body is too large");
    }
    chunks.push(buffer);
  }

  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Request body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

process.once("SIGINT", () => {
  void shutdown();
});

process.once("SIGTERM", () => {
  void shutdown();
});

async function shutdown(): Promise<void> {
  await disconnectFromTikTok();
  webSocketServer.close();
  server.close(() => process.exit(0));
}
