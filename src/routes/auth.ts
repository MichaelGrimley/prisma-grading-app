import {Hono} from "hono";
import { zValidator} from "@hono/zod-validator";
import { z } from "zod";
import type {AppEnv} from "../lib/prisma";
import {sendEmailToken} from "../lib/email";
import{
    authTokenExpiration,
    emailTokenExpiration,
    generateAuthToken,
    generateEmailToken
}from "../lib/auth";

const auth = new Hono<AppEnv>();

// Step 1: log in or sign up. Creates the user if new, stores a short-lived
// email token, and sends it to the user's email.

auth.post("/login", zValidator("json", z.object({email: z.email()})), async (c) => {
    const prisma = c.get("prisma");
    const {email} = c.req.valid("json");

    const emailToken = generateEmailToken();

    await prisma.token.create({
        data: {
            emailToken,
            type: "EMAIL",
            expiration: emailTokenExpiration(),
            user: {
                connectOrCreate: {
                    where: {email},
                    create: {email},
                },
            },
        },
    });

    await sendEmailToken(email, emailToken);

    return c.body(null, 200);
});

// Step 2: exchange the email token for a long-lived JWT. Validates the email
// token, mints an API token in the database, invalidates the email token, and
// returns the signed JWT in the Authorization header.
auth.post(
    "/authenticate",
    zValidator("json", z.object({email: z.email(), emailToken: z.string()})),
    async (c) => {
        const prisma = c.get("prisma");
        const {email, emailToken} = c.req.valid("json");

        const fetchedToken = await prisma.token.findUnique({
            where: {emailToken},
            include: {user:true},
        });

        if(!fetchedToken || !fetchedToken.valid){
            return c.json({error: "Unauthorized"}, 401);
        }

        if(fetchedToken.expiration < new Date()){
            return c.json({error: "Token expired"}, 401)
        }

        if (fetchedToken.user.email !== email){
            return c.json({error: "Unauthorized"}, 401);
        }

        const createdToken = await prisma.token.create({
            data: {
                type: "API",
                expiration: authTokenExpiration(),
                user: {connect: {email}},
            },
        });

        await prisma.token.update({
            where: {id: fetchedToken.id},
            data: {valid: false},
        });

        const authToken = await generateAuthToken(createdToken.id);
        c.header("Authorization", authToken);
        return c.json({authToken}, 200);
    },
);

export default auth;