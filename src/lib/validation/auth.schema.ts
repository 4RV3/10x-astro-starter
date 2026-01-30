import { z } from "zod";

export const registerCommandSchema = z.object({
  email: z.string().email({ message: "Invalid email format" }).max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be at most 32 characters"),
});

export const loginCommandSchema = z.object({
  username: z.string().trim().min(3).max(32),
  password: z.string().min(8).max(128),
});
