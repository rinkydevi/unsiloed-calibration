-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "docType" TEXT NOT NULL,
    "schemaId" TEXT,
    "totalFields" INTEGER NOT NULL,
    "overallAccuracy" DOUBLE PRECISION NOT NULL,
    "stpThreshold" DOUBLE PRECISION NOT NULL,
    "stpRate" DOUBLE PRECISION NOT NULL,
    "stpTarget" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "sampleSizeWarning" BOOLEAN NOT NULL DEFAULT false,
    "thresholdCILower" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thresholdCIUpper" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "resultJson" TEXT NOT NULL,
    "docNamesJson" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,

    CONSTRAINT "CalibrationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomSchema" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fieldsJson" TEXT NOT NULL,
    "jsonSchema" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CustomSchema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "CalibrationRun" ADD CONSTRAINT "CalibrationRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomSchema" ADD CONSTRAINT "CustomSchema_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
