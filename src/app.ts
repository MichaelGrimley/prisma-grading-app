import { Hono } from "hono";
import { withPrisma, type AppEnv } from "./lib/prisma";
import { authMiddleware } from "./lib/auth";
import status from "./routes/status";
import auth from "./routes/auth";
import users from "./routes/users";

const app = new Hono<AppEnv>();

app.use("*", withPrisma);

//opens Routes (no authentication required).
app.route("/", status);
app.route("/", auth);

//Everything register below required a valid JWT.
app.use("*", authMiddleware);
app.route("/", users);

export default app;