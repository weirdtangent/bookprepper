import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const url = new URL(databaseUrl);

// MySQL 8.4 authenticates with caching_sha2_password, whose server-side cache is
// empty after every mysqld start. On a cache miss the server demands full auth,
// which a client can only complete over TLS or by fetching the server's RSA public
// key — with neither available the driver refuses, every pool connection fails to
// open, and the API 500s on all DB routes until something else authenticates this
// account (see the 2026-08-13 post-reboot outage).
//
// Retrieving the key is only safe when there is no wire to intercept, so it is
// gated to loopback. A remote DATABASE_URL must complete full auth over TLS
// instead — enable ssl on the adapter rather than widening this.
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const isLoopback = LOOPBACK_HOSTS.has(url.hostname);

const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  connectionLimit: 10,
  minimumIdle: 2,
  idleTimeout: 600,
  allowPublicKeyRetrieval: isLoopback,
});

type GlobalWithPrisma = typeof globalThis & {
  prisma?: PrismaClient;
};

const globalForPrisma = globalThis as GlobalWithPrisma;

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.PRISMA_LOG_LEVEL === "silent" ? [] : ["warn", "error"],
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
