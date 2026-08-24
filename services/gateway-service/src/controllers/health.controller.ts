import { Request, Response } from "express";

import { services } from "../config/services";

const TIMEOUT_MS = 2500;

export const getHealth = async (_req: Request, res: Response) => {
  const statuses = await Promise.all(
    services.map(async (service) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        await fetch(`${service.baseUrl}/`, {
          method: "GET",
          signal: controller.signal,
        });

        clearTimeout(timeout);
        return { service: service.name, status: "up" };
      } catch {
        return { service: service.name, status: "down" };
      }
    }),
  );

  return res.status(200).json({
    success: true,
    data: {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      services: statuses,
    },
  });
};
