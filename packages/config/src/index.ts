import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  MYSQL_HOST: z.string().default("localhost"),
  MYSQL_PORT: z.coerce.number().default(3306),
  MYSQL_DATABASE: z.string().default("bookprepper"),
  MYSQL_USER: z.string().default("bookprepper"),
  MYSQL_PASSWORD: z.string().default("change-me"),
  DATABASE_URL: z
    .string()
    .default(
      "mysql://bookprepper:change-me@localhost:3306/bookprepper?connection_limit=5&socket_timeout=10"
    ),
  API_BASE_URL: z.string().url().default("http://localhost:4000"),
  WEB_BASE_URL: z.string().url().default("http://localhost:5173"),
  COGNITO_REGION: z.string().default("us-east-1"),
  COGNITO_USER_POOL_ID: z.string().default("us-east-1_XXXXXXX"),
  COGNITO_CLIENT_ID: z.string().default("clientid"),
  COGNITO_DOMAIN: z.string().default("https://example.auth.us-east-1.amazoncognito.com"),
  COGNITO_REDIRECT_SIGNIN: z.string().url().default("http://localhost:5173/auth/callback"),
  COGNITO_REDIRECT_SIGNOUT: z.string().url().default("http://localhost:5173/"),
  ADMIN_EMAIL: z.string().email("Set ADMIN_EMAIL to the trusted admin account email")
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;

