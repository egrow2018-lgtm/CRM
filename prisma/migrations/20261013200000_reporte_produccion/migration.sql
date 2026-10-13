-- AlterTable
ALTER TABLE "User" ADD COLUMN     "productionReport" BOOLEAN NOT NULL DEFAULT false;


-- Janine Salgado (seguimiento de proyectos) recibe el reporte desde el inicio
UPDATE "User" SET "productionReport" = true WHERE lower(email) = 'mjsalgado@e-growonline.com';
