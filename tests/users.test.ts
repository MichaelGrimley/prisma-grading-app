import { describe, test, expect, afterAll } from "vitest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { generateAuthToken } from "../src/lib/auth";
import { createDecipheriv } from "node:crypto";
import { create } from "node:domain";

async function createUserWithToken(isAdmin = false) {
  const user = await prisma.user.create({
    data: {
      email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      isAdmin,
      tokens: {
        create: {
          type: "API",
          expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    },
    include: { tokens: true },
  });
  const authToken = await generateAuthToken(user.tokens[0].id);
  return { user, authToken };
}

test("a user can GET their own record", async () => {
  const { user, authToken } = await createUserWithToken();
  const res = await app.request(`/users/${user.id}`, {
    headers: authHeader(authToken),
  });
  expect(res.status).toBe(200);
  expect((await res.json()).id).toBe(user.id);
});

test("a non-admin cannot GET another user's record", async () => {
  const { authToken } = await createUserWithToken();
  const other = await createUserWithToken();
  const res = await app.request(`/users/${other.user.id}`, {
    headers: authHeader(authToken),
  });
  expect(res.status).toBe(403);
});

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("User routes", () => {
  let userId: number;

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("POST /users creates a user", async () => {
    const { authToken } = await createUserWithToken(true);
    const res = await app.request("/users", {
      method: "POST",
      headers: { ...authHeader(authToken), "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "test-first-name",
        lastName: "test-last-name",
        email: `test-${Date.now()}@prisma.io`,
        social: { bluesky: "thisisalice", website: "https://thisisalice.com" },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    userId = body.id;
    expect(typeof userId).toBe("number");
  });

  test("POST /users rejects invalid input with 400", async () => {
    const { authToken } = await createUserWithToken(true);

    const res = await app.request("/users", {
      method: "POST",
      headers: { ...authHeader(authToken), "Content-Type": "application/json" },
      body: JSON.stringify({
        lastName: "test-last-name",
        email: `test-${Date.now()}@prisma.io`,
      }),
    });

    expect(res.status).toBe(400);
  });

  test("GET /users/:userId returns 404 for a non-existent user", async () => {
    const { authToken } = await createUserWithToken(true);

    const res = await app.request("/users/999999", {
      headers: authHeader(authToken),
    });
    expect(res.status).toBe(404);
  });

  test("GET /users/:userId returns the user", async () => {
    const { user, authToken } = await createUserWithToken();

    const res = await app.request(`/users/${user.id}`, {
      headers: authHeader(authToken),
    });

    //uses userId from the first test, therefore valid userId
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(user.id);
  });

  test("PUT /users/:userId fails with 400 for an invalid id", async () => {
    const { authToken } = await createUserWithToken();

    const res = await app.request("/users/aa22", {
      method: "PUT",
      headers: { ...authHeader(authToken), "Content-type": "application/json" },
      body: JSON.stringify({ firstName: "x" }),
    });
    expect(res.status).toBe(400);
  });

  test("PUT /users/:userId updates the user", async () => {
    const { user, authToken } = await createUserWithToken();

    const res = await app.request(`/users/${user.id}`, {
      method: "PUT",
      headers: { ...authHeader(authToken), "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "test-first-name-UPDATED",
        lastName: "test-last-name-UPDATED",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.firstName).toBe("test-first-name-UPDATED");
    expect(body.lastName).toBe("test-last-name-UPDATED");
  });

  test("delete /users/:userId fails with 400 for an invalid id", async () => {
    const { authToken } = await createUserWithToken();

    const res = await app.request("/users/aa22", {
      method: "DELETE",
      headers: authHeader(authToken),
    });
    expect(res.status).toBe(400);
  });

  test("DELETE /users/:userId deletes the user", async () => {
    const { user, authToken } = await createUserWithToken();

    const res = await app.request(`/users/${user.id}`, {
      method: "DELETE",
      headers: authHeader(authToken),
    });
    expect(res.status).toBe(204);
  });
});
