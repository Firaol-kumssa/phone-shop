-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('Active', 'Discontinued');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "status" "product_status" NOT NULL DEFAULT 'Active';
