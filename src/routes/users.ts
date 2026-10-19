import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../lib/prisma";
import { isRequestedUserOrAdmin, requireAdmin } from "../lib/auth";


const users = new Hono<AppEnv>();

export default users;

const userSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  social: z
    .object({
      bluesky: z.string().optional(),
      linkedin: z.string().optional(),
      website: z.string().optional(),
    })
    .optional(),
});

const updateUserSchema = userSchema.partial(); //reuses scheme but makes every field optional, to allow updating just one variable.

users.post("/users", requireAdmin, zValidator("json", userSchema), async (c) => {
  const prisma = c.get("prisma");
  const data = c.req.valid("json");

  const createdUser = await prisma.user.create({
    data,
    select: { id: true },
  });

  return c.json(createdUser, 201);
});

const userIdParam = z.object({
  userId: z.coerce.number().int(),
});

//Any authenticated user can read their own profile
users.get("/profile", async (c) => {
    const prisma = c.get("prisma");
    const {userId} = c.get("credentials");
    const user = await prisma.user.findUnique({where: {id: userId}});
    return c.json(user,200);
});



users.get("/users/:userId", zValidator("param", userIdParam), isRequestedUserOrAdmin, async (c) => {
  const prisma = c.get("prisma");
  const { userId } = c.req.valid("param");

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return c.body(null, 404);
  }
  return c.json(user, 200);
});

users.put(
  "/users/:userId",
  zValidator("param", userIdParam), isRequestedUserOrAdmin,
  zValidator("json", updateUserSchema),
  async (c) => {
    const prisma = c.get("prisma");
    const { userId } = c.req.valid("param");
    const data = c.req.valid("json");

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
    });
    return c.json(updatedUser, 200);
  },
);

users.delete("/users/:userId", zValidator("param", userIdParam), async (c) => {
  const prisma = c.get("prisma");
  const { userId } = c.req.valid("param");

  await prisma.user.delete({ where: { id: userId } });

  return c.body(null, 204);
});
