import { Hono } from "hono";
import type { AppEnv } from "../lib/prisma";

const status = new Hono<AppEnv>();

status.get("/", (c) => {
  return c.json({ up: true }, 200);
});

export default status;