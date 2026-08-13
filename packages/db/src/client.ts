import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const url = new URL(databaseUrl);
const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  connectionLimit: 10,
  minimumIdle: 2,
  idleTimeout: 600,
  // MySQL 8.4 authenticates with caching_sha2_password, whose server-side cache is
  // empty after every mysqld start. On a cache miss the server demands full auth,
  // which the client can only complete over TLS or by fetching the server's RSA
  // public key — without this flag the driver refuses, every pool connection fails
  // to open, and the API 500s on all DB routes until something else authenticates
  // this account (see the 2026-08-13 post-reboot outage). Safe here because the
  // connection is loopback-only: the key-substitution risk it guards against needs
  // a MITM on the wire, and there is no wire.
  allowPublicKeyRetrieval: true,
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
