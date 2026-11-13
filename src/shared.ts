export type GiftMessage = {
  type: "gift";
  id: string;
  userName: string;
  giftId: string;
  giftName: string;
  repeatCount: number;
  diamonds: number;
  timestamp: number;
};

export type StatusMessage = {
  type: "status";
  state: "disconnected" | "connecting" | "connected" | "error";
  username: string;
  message: string;
};

export type ServerMessage = GiftMessage | StatusMessage;

export function isServerMessage(value: unknown): value is ServerMessage {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }

  if (value.type === "status") {
    return (
      "state" in value &&
      "username" in value &&
      "message" in value &&
      typeof value.state === "string" &&
      typeof value.username === "string" &&
      typeof value.message === "string"
    );
  }

  return (
    value.type === "gift" &&
    "id" in value &&
    "userName" in value &&
    "giftId" in value &&
    "giftName" in value &&
    "repeatCount" in value &&
    "diamonds" in value &&
    "timestamp" in value &&
    typeof value.id === "string" &&
    typeof value.userName === "string" &&
    typeof value.giftId === "string" &&
    typeof value.giftName === "string" &&
    typeof value.repeatCount === "number" &&
    typeof value.diamonds === "number" &&
    typeof value.timestamp === "number"
  );
}
