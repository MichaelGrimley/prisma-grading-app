import {sign, verify} from "hono/jwt";
import type {Context, Next} from "hono";
import type {AppEnv} from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET || "SUPER_SECRET_JWT_SECRET";
const JWT_ALGORITHM = "HS256" as const;

const EMAIL_TOKEN_EXPIRATION_MINUTES = 10;
const AUTH_TOKEN_EXPIRATION_HOURS = 12;

export const emailTokenExpiration = () =>
    new Date(Date.now() + EMAIL_TOKEN_EXPIRATION_MINUTES * 60 * 1000);

export const authTokenExpiration = () =>
    new Date(Date.now() + AUTH_TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000);

//Generate a random 8-digit number as the email token.
export function generateEmailToken(): string {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

//Sign a JWT that references the API token stored in the database.
export function generateAuthToken(tokenId: number): Promise<string>{
    return sign({tokenId}, JWT_SECRET, JWT_ALGORITHM);
}

//Runs on every protected request: verifies the JWT, checks the referenced
//token in the database, and attaches the user's credentials to the context.
export async function authMiddleware(c: Context<AppEnv>, next: Next){
    const authHeader = c.req.header("Authorization");
    if(!authHeader){
        return c.json({error: "Missing Authentication"}, 401)
    }

const token = authHeader.replace(/^Bearer\s+/i, "");

let payload;
try{
    payload = await verify(token, JWT_SECRET, JWT_ALGORITHM);
}catch{
    return c.json({error: "invalid token"}, 401);
}

const tokenId = payload.tokenId;
if(typeof tokenId !== "number"){
    return c.json({error: "Invalid token"}, 401);
}

const prisma = c.get("prisma");
const fetchedToken = await prisma.token.findUnique({
    where: {id: tokenId},
    include: {user: true},
})
if(!fetchedToken || !fetchedToken.valid){
    return c.json({error: "Invalid token"}, 401);
}

if(fetchedToken.expiration < new Date()){
    return c.json({error: "Token expired"}, 401);
}

const teacherOf = await prisma.courseEnrollment.findMany({
    where: {userId: fetchedToken.userId, role: "TEACHER"},
    select: {courseId: true},
})

c.set("credentials",{
    tokenId,
    userId: fetchedToken.userId,
    isAdmin: fetchedToken.user.isAdmin,
    teacherOf: teacherOf.map(({courseId}) => courseId),
});

await next();
}

//Allows admins, or the user acting on their own account.
export async function isRequestedUserOrAdmin(c: Context<AppEnv>, next: Next){
    const{userId, isAdmin} = c.get("credentials");
    if(isAdmin){
        return next();
    }
    const requestedUserId = Number(c.req.param("userId"));
    if(requestedUserId ===userId){
        return next();
    }
    return c.json({error: "Forbidden"}, 403);
}

//Allow admins, or a teacher of the requested course.
export async function isTeacherOfCourseOrAdmin(c: Context<AppEnv>, next: Next){
    const{isAdmin, teacherOf} = c.get("credentials");
    if(isAdmin){
        return next();
    }
    const courseId = Number(c.req.param("courseId"));
    if(teacherOf.includes(courseId)){
        return next();
    }
    return c.json({error: "Forbidden"}, 403);  
}


//Allows admins only.
export async function requireAdmin(c: Context<AppEnv>, next: Next){
    const {isAdmin} = c.get("credentials");
    if(!isAdmin){
        return c.json({error: "Forbidden"}, 403);
        }
return next();
}





