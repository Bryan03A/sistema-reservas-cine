import { Router } from "express";
import { register, token, jwks } from "./auth.controller";
import rateLimit from "express-rate-limit";

const router = Router();

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos. Intenta nuevamente más tarde."
  }
});

router.post("/auth/register", register);

router.post("/oauth/token", loginLimiter, token);

router.get("/.well-known/jwks.json", jwks);

export default router;
