-- Members can now be created before they ever log in
ALTER TABLE "User" ALTER COLUMN "supabaseId" DROP NOT NULL;
