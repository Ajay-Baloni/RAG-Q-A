import type { Request, Response } from "express";
import { z } from "zod";
import * as authService from "./auth.service";
import { AppError } from "../../utils/AppError";

const credentialsSchema = z.object({
  email: z.string().email("A valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function register(req: Request, res: Response) {
  const { email, password } = credentialsSchema.parse(req.body);
  const result = await authService.register(email, password);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const { email, password } = credentialsSchema.parse(req.body);
  const result = await authService.login(email, password);
  res.json(result);
}

export async function me(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const user = await authService.getUserById(req.user.id);
  res.json({ user });
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  await authService.changePassword(req.user!.id, currentPassword, newPassword);
  res.json({ message: "Password updated" });
}

const forgotPasswordSchema = z.object({
  email: z.string().email("A valid email is required"),
});

export async function forgotPassword(req: Request, res: Response) {
  const { email } = forgotPasswordSchema.parse(req.body);
  await authService.forgotPassword(email);
  // Always the same response, regardless of whether the email exists.
  res.json({
    message: "If an account exists for that email, a reset link has been sent.",
  });
}

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = resetPasswordSchema.parse(req.body);
  await authService.resetPassword(token, newPassword);
  res.json({ message: "Password has been reset" });
}
