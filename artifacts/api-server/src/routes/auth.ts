import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import {
  clearSession,
  getSessionId,
  createSession,
  SESSION_COOKIE,
  SESSION_TTL,
  checkPassword,
  type SessionData,
} from "../lib/auth";

const router: IRouter = Router();

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

router.get("/auth/me", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.post("/auth/login", async (req: Request, res: Response) => {
  const { password } = req.body ?? {};

  if (typeof password !== "string" || !password) {
    res.status(400).json({ error: "Password required" });
    return;
  }

  if (!(await checkPassword(password))) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  const sessionData: SessionData = {
    user: {
      id: "admin",
      email: null,
      firstName: "Ben",
      lastName: null,
      profileImageUrl: null,
    },
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.json({ success: true });
});

router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect("/");
});

export default router;
