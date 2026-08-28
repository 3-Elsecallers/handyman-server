import { Request, Response, NextFunction } from "express";
import * as userService from "../services/userService";
import * as notificationPrefsService from "../services/notificationPrefsService";
import { prisma } from "../db/prisma";

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userService.getUserById(req.params.id as string);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const getNotificationPrefs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prefs = await notificationPrefsService.getPreferences(req.params.id as string);
    res.json({ success: true, data: prefs });
  } catch (error) {
    next(error);
  }
};

export const validateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds)) {
      return res.status(400).json({ success: false, message: "userIds array required" });
    }
    const users = await userService.getUsersByIds(userIds);
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const batchGetUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ids = (req.query.ids as string)?.split(",") || [];
    const users = await userService.getUsersByIds(ids);
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const searchUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.query as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    if (!query || !query.trim()) {
      return res.json({ success: true, data: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
      take: Math.min(limit, 50),
    });

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};
