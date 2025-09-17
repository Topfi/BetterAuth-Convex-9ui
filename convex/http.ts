import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./features/auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, { cors: true });

export default http;
