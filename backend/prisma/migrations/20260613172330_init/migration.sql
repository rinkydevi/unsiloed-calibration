-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CalibrationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "docType" TEXT NOT NULL,
    "schemaId" TEXT,
    "totalFields" INTEGER NOT NULL,
    "overallAccuracy" REAL NOT NULL,
    "stpThreshold" REAL NOT NULL,
    "stpRate" REAL NOT NULL,
    "stpTarget" REAL NOT NULL DEFAULT 0.95,
    "sampleSizeWarning" BOOLEAN NOT NULL DEFAULT false,
    "thresholdCILower" REAL NOT NULL DEFAULT 0,
    "thresholdCIUpper" REAL NOT NULL DEFAULT 1,
    "resultJson" TEXT NOT NULL,
    "docNamesJson" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    CONSTRAINT "CalibrationRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomSchema" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fieldsJson" TEXT NOT NULL,
    "jsonSchema" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "CustomSchema_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
