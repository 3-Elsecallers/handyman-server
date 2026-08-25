import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { Server } from "http";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import * as messageService from "../services/messageService";
import * as conversationService from "../services/conversationService";
import type { IUserPayload } from "../types/custom";

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  user?: IUserPayload;
  isAlive?: boolean;
}

interface WSMessage {
  event: string;
  data: Record<string, unknown>;
}

const clients = new Map<string, AuthenticatedSocket>();

function authenticateToken(token: string): IUserPayload | null {
  try {
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || "") as IUserPayload;
    return payload;
  } catch {
    return null;
  }
}

function broadcastToConversation(
  conversationId: string,
  message: Record<string, unknown>,
  excludeUserId?: string,
) {
  conversationService
    .getConversationById(conversationId)
    .then((conversation) => {
      const participants = [conversation.customerId, conversation.providerId];
      for (const participantId of participants) {
        if (participantId === excludeUserId) continue;
        const client = clients.get(participantId);
        if (client?.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      }
    })
    .catch(() => {});
}

export function initWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: AuthenticatedSocket, req: IncomingMessage) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(1008, "Missing token");
      return;
    }

    const user = authenticateToken(token);
    if (!user) {
      ws.close(1008, "Invalid token");
      return;
    }

    ws.userId = user.id;
    ws.user = user;
    ws.isAlive = true;

    // Close existing connection for this user
    const existing = clients.get(user.id);
    if (existing && existing !== ws) {
      existing.close(1000, "Replaced by new connection");
    }

    clients.set(user.id, ws);
    console.log(`[WS] User ${user.id} connected (${clients.size} online)`);

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (raw) => {
      try {
        const msg: WSMessage = JSON.parse(raw.toString());
        await handleWSMessage(ws, msg);
      } catch (error) {
        console.error("[WS] Error handling message:", error);
        ws.send(JSON.stringify({ event: "error", data: { message: "Invalid message format" } }));
      }
    });

    ws.on("close", () => {
      clients.delete(ws.userId!);
      console.log(`[WS] User ${ws.userId} disconnected (${clients.size} online)`);
    });

    ws.send(JSON.stringify({ event: "connected", data: { userId: user.id } }));
  });

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      const authWs = ws as AuthenticatedSocket;
      if (authWs.isAlive === false) return authWs.terminate();
      authWs.isAlive = false;
      authWs.ping();
    });
  }, 30_000);

  wss.on("close", () => clearInterval(heartbeat));

  return wss;
}

async function handleWSMessage(ws: AuthenticatedSocket, msg: WSMessage) {
  switch (msg.event) {
    case "message:send": {
      const { conversationId, content, type, imageUrl } = msg.data;
      if (!conversationId || !content) {
        ws.send(JSON.stringify({ event: "error", data: { message: "conversationId and content required" } }));
        return;
      }

      await conversationService.assertUserInConversation(
        conversationId as string,
        ws.userId!,
      );

      const message = await messageService.sendMessage(
        conversationId as string,
        ws.userId!,
        content as string,
        (type as string) || "text",
        imageUrl as string | undefined,
      );

      broadcastToConversation(conversationId as string, {
        event: "message:new",
        data: message,
      });
      break;
    }

    case "message:read": {
      const { conversationId } = msg.data;
      if (!conversationId) return;

      await conversationService.assertUserInConversation(
        conversationId as string,
        ws.userId!,
      );

      await messageService.markMessagesAsRead(
        conversationId as string,
        ws.userId!,
      );

      broadcastToConversation(
        conversationId as string,
        { event: "message:read", data: { conversationId, userId: ws.userId } },
        ws.userId,
      );
      break;
    }

    case "typing:start": {
      const { conversationId } = msg.data;
      if (!conversationId) return;
      broadcastToConversation(
        conversationId as string,
        { event: "typing:start", data: { conversationId, userId: ws.userId } },
        ws.userId,
      );
      break;
    }

    case "typing:stop": {
      const { conversationId } = msg.data;
      if (!conversationId) return;
      broadcastToConversation(
        conversationId as string,
        { event: "typing:stop", data: { conversationId, userId: ws.userId } },
        ws.userId,
      );
      break;
    }

    case "ping": {
      ws.send(JSON.stringify({ event: "pong", data: {} }));
      break;
    }

    default:
      ws.send(JSON.stringify({ event: "error", data: { message: `Unknown event: ${msg.event}` } }));
  }
}

export function isUserOnline(userId: string): boolean {
  const client = clients.get(userId);
  return client?.readyState === WebSocket.OPEN;
}
