import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const rawConnection = (process.env.DATABASE_URL || process.env.DIRECT_URL || "").replace(/^["']|["']$/g, "");
// Replace deprecated SSL modes with verify-full to avoid pg-connection-string warning
const connectionString = rawConnection.replace(/sslmode=(prefer|require|verify-ca)/g, "sslmode=verify-full");

const globalForPrisma = globalThis as unknown as { prisma: InstanceType<typeof PrismaClient> };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
