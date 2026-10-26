import type {Request,Response,NextFunction} from "express";
type Role="CEO"|"HR"|"MANAGER"|"EMPLOYEE";
export function requireRole(...allowed:Role[]){return (_req:Request,res:Response,next:NextFunction)=>{const user=res.locals.user as {role?:Role}|undefined;if(!user?.role||!allowed.includes(user.role))return res.status(403).json({error:"You do not have permission to perform this action"});next();};}
