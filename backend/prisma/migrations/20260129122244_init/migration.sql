-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "avatar" TEXT,
    "accountType" TEXT NOT NULL,
    "accountRole" TEXT NOT NULL,
    "roomRole" TEXT,
    "teamId" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "micEnabled" BOOLEAN NOT NULL DEFAULT false,
    "speakerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isSpeaking" BOOLEAN NOT NULL DEFAULT false,
    "roomId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'preparing',
    "maxUsers" INTEGER NOT NULL DEFAULT 20,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "leaderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamColor" TEXT NOT NULL,
    "captainId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "roomId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Team_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
