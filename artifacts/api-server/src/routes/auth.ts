import * as oidc from "openid-client";
import { randomBytes } from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetCurrentAuthUserResponse,
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import { db, usersTable, siteConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;
const ADMIN_CONFIG_KEY = "admin_user_id";
const SETUP_TOKEN_KEY = "setup_token";
const SETUP_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

const router: IRouter = Router();

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }
  return value;
}

async function getAdminUserId(): Promise<string | null> {
  // Env var takes precedence over DB for easy override
  if (process.env.ADMIN_USER_ID) {
    return process.env.ADMIN_USER_ID;
  }
  const [row] = await db
    .select()
    .from(siteConfigTable)
    .where(eq(siteConfigTable.key, ADMIN_CONFIG_KEY));
  return row?.value ?? null;
}

async function isOwner(userId: string): Promise<boolean> {
  const adminId = await getAdminUserId();
  if (!adminId) return false;
  return userId === adminId;
}

async function upsertUser(claims: Record<string, unknown>) {
  const userData = {
    id: claims.sub as string,
    email: (claims.email as string) || null,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as
      | string
      | null,
  };

  const [user] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        ...userData,
        updatedAt: new Date(),
      },
    })
    .returning();
  return user;
}

// ──────────────────────────────────────────────
// Auth user endpoints — public (no requireAuth)
// ──────────────────────────────────────────────

// /api/auth/me and /api/auth/user are aliases — both return current user
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

// Returns whether the admin user has been configured
router.get("/auth/setup-status", async (_req: Request, res: Response) => {
  const adminId = await getAdminUserId();
  res.json({ configured: !!adminId });
});

// ──────────────────────────────────────────────
// First-time setup: claim admin via one-time token + optional secret gate
// ──────────────────────────────────────────────
//
// Flow:
//   1. User visits the app and clicks "Authenticate via Replit"
//   2. They go through OIDC → /callback
//   3. Callback sees no admin configured → generates a signed setup token
//      stored in DB and redirects to /?setup=pending&token=<tok>&uid=<uid>
//   4. Frontend shows setup page with "Claim ownership" button
//      (if SETUP_SECRET is set, the user must enter it to proceed)
//   5. POST /api/auth/claim-admin validates token + optional secret, writes admin ID
//
// Security tiers (apply in descending preference):
//   - ADMIN_USER_ID env var: most secure, set before first deploy, no setup flow needed
//   - SETUP_SECRET env var: requires knowledge of a shared secret to claim admin;
//     set this before first deploy to prevent unauthorized ownership claims
//   - No config: one-time token flow only — first user through OIDC can claim admin
//
router.post("/auth/claim-admin", async (req: Request, res: Response) => {
  const existingAdmin = await getAdminUserId();
  if (existingAdmin) {
    res.status(403).json({ error: "Admin is already configured." });
    return;
  }

  const token = (req.query.token as string) || (req.body?.token as string);
  const uid = (req.query.uid as string) || (req.body?.uid as string);
  const secret = (req.query.secret as string) || (req.body?.secret as string);

  if (!token || !uid) {
    res.status(400).json({ error: "Missing token or uid." });
    return;
  }

  // Validate SETUP_SECRET if configured
  const requiredSecret = process.env.SETUP_SECRET;
  if (requiredSecret) {
    if (!secret || secret !== requiredSecret) {
      res.status(403).json({ error: "Invalid setup secret." });
      return;
    }
  }

  // Validate the one-time setup token from DB
  const [row] = await db
    .select()
    .from(siteConfigTable)
    .where(eq(siteConfigTable.key, SETUP_TOKEN_KEY));

  if (!row) {
    res.status(403).json({ error: "No setup token found. Please log in again." });
    return;
  }

  // Token format: "<token>:<uid>:<expires_ms>"
  const parts = row.value.split(":");
  if (parts.length !== 3) {
    res.status(403).json({ error: "Invalid setup token format." });
    return;
  }
  const [storedToken, storedUid, expiresStr] = parts;

  if (
    storedToken !== token ||
    storedUid !== uid ||
    Date.now() > parseInt(expiresStr, 10)
  ) {
    res.status(403).json({ error: "Invalid or expired setup token." });
    return;
  }

  // Token valid — store admin user ID and clean up setup token
  await db
    .insert(siteConfigTable)
    .values({ key: ADMIN_CONFIG_KEY, value: uid })
    .onConflictDoUpdate({
      target: siteConfigTable.key,
      set: { value: uid },
    });

  await db
    .delete(siteConfigTable)
    .where(eq(siteConfigTable.key, SETUP_TOKEN_KEY));

  // Upsert user record so we can create a session
  const dbUser = await upsertUser({ sub: uid });

  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    access_token: undefined,
    refresh_token: undefined,
    expires_at: undefined,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);

  res.json({ success: true, adminUserId: uid });
});

// ──────────────────────────────────────────────
// Standard OIDC login / callback / logout
// ──────────────────────────────────────────────

router.get("/login", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const returnTo = getSafeReturnTo(req.query.returnTo);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

// Query params are not validated because the OIDC provider may include
// parameters not expressed in the schema.
router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.return_to);

  res.clearCookie("code_verifier", { path: "/" });
  res.clearCookie("nonce", { path: "/" });
  res.clearCookie("state", { path: "/" });
  res.clearCookie("return_to", { path: "/" });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  const userId = claims.sub as string;

  const adminId = await getAdminUserId();

  if (!adminId) {
    // No admin yet — generate a one-time setup token so the user can claim admin.
    const setupToken = randomBytes(32).toString("hex");
    const expires = Date.now() + SETUP_TOKEN_TTL_MS;
    const tokenValue = `${setupToken}:${userId}:${expires}`;

    await db
      .insert(siteConfigTable)
      .values({ key: SETUP_TOKEN_KEY, value: tokenValue })
      .onConflictDoUpdate({
        target: siteConfigTable.key,
        set: { value: tokenValue },
      });

    const setupUrl = new URL("/", getOrigin(req));
    setupUrl.searchParams.set("setup", "pending");
    setupUrl.searchParams.set("token", setupToken);
    setupUrl.searchParams.set("uid", userId);
    res.redirect(setupUrl.toString());
    return;
  }

  if (!(await isOwner(userId))) {
    res.status(403).send("Access denied. This console is private.");
    return;
  }

  const dbUser = await upsertUser(
    claims as unknown as Record<string, unknown>,
  );

  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(returnTo);
});

router.get("/logout", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const origin = getOrigin(req);

  const sid = getSessionId(req);
  await clearSession(res, sid);

  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: process.env.REPL_ID!,
    post_logout_redirect_uri: origin,
  });

  res.redirect(endSessionUrl.href);
});

// ──────────────────────────────────────────────
// Mobile auth (Expo)
// ──────────────────────────────────────────────

router.post(
  "/mobile-auth/token-exchange",
  async (req: Request, res: Response) => {
    const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required parameters" });
      return;
    }

    const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;

    try {
      const config = await getOidcConfig();

      const callbackUrl = new URL(redirect_uri);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", state);
      callbackUrl.searchParams.set("iss", ISSUER_URL);

      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: code_verifier,
        expectedNonce: nonce ?? undefined,
        expectedState: state,
        idTokenExpected: true,
      });

      const claims = tokens.claims();
      if (!claims) {
        res.status(401).json({ error: "No claims in ID token" });
        return;
      }

      const userId = claims.sub as string;

      const adminId = await getAdminUserId();
      if (!adminId) {
        res.status(403).json({
          error: "BenAdmin is not configured. Complete the web setup first.",
        });
        return;
      }

      if (!(await isOwner(userId))) {
        res.status(403).json({ error: "Access denied." });
        return;
      }

      const dbUser = await upsertUser(
        claims as unknown as Record<string, unknown>,
      );

      const now = Math.floor(Date.now() / 1000);
      const sessionData: SessionData = {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          profileImageUrl: dbUser.profileImageUrl,
        },
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
      };

      const sid = await createSession(sessionData);
      res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
    } catch (err) {
      console.error("Mobile token exchange error:", err);
      res.status(500).json({ error: "Token exchange failed" });
    }
  },
);

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;
