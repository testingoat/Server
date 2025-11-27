import AdminJS from "adminjs";
import AdminJSFastify from "@adminjs/fastify";
import * as AdminJSMongoose from "@adminjs/mongoose";
import * as Models from "../models/index.js";
import { authenticate, COOKIE_PASSWORD, sessionStore } from "./config.js";
import { dark, light, noSidebar } from "@adminjs/themes";

AdminJS.registerAdapter(AdminJSMongoose)

export const admin = new AdminJS({
    resources:[
        {
            resource: Models.Customer,
            options: {
              listProperties: ["phone", "role", "isActivated"],
              filterProperties: ["phone", "role"],
            },
          },
          {
            resource: Models.DeliveryPartner,
            options: {
              listProperties: ["email", "role", "isActivated"],
              filterProperties: ["email", "role"],
            },
          },
          {
            resource: Models.Admin,
            options: {
              listProperties: ["email", "role", "isActivated"],
              filterProperties: ["email", "role"],
            },
          },
        { resource: Models.Branch },
        { resource: Models.Product },
        { resource: Models.Category },
        { resource: Models.Order },
        { resource: Models.Counter },
    ],
    branding: {
        companyName: "Grocery Delivery App",
        withMadeWithLove: false,
    },
    defaultTheme:dark.id,
    availableThemes: [dark,light,noSidebar],
    rootPath:'/admin'
})

export const buildAdminRouter = async(app)=>{
    console.log('🔧 Building AdminJS router...');
    console.log('🔍 COOKIE_PASSWORD exists:', !!COOKIE_PASSWORD);
    console.log('🔍 SessionStore exists:', !!sessionStore);
    console.log('🔍 Environment:', process.env.NODE_ENV);

    await AdminJSFastify.buildAuthenticatedRouter(
        admin,
        {
            authenticate,
            cookiePassword: COOKIE_PASSWORD,
            cookieName: 'adminjs'
        },
        app,
        {
            store: sessionStore,
            saveUnintialized: true,
            secret: COOKIE_PASSWORD,
            cookie: {
              httpOnly: false, // Allow JavaScript access for debugging
              secure: false,   // Allow HTTP for now to fix login
              sameSite: 'lax', // More permissive for cross-origin
              maxAge: 24 * 60 * 60 * 1000, // 24 hours
            },
        }
    );

    console.log('✅ AdminJS router built successfully');
}// AdminJS sync test comment - 09/27/2025 02:38:52
