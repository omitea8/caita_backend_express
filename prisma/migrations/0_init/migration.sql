-- CreateTable
CREATE TABLE "creators" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "twitter_system_id" TEXT,
    "twitter_id" TEXT,
    "twitter_name" TEXT,
    "twitter_profile_image" TEXT,
    "twitter_description" TEXT,
    "created_at" datetime(6) NOT NULL,
    "updated_at" datetime(6) NOT NULL
);

-- CreateTable
CREATE TABLE "images" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caption" TEXT,
    "image_url" TEXT,
    "creator_id" INTEGER NOT NULL,
    "created_at" datetime(6) NOT NULL,
    "updated_at" datetime(6) NOT NULL,
    "storage_name" TEXT,
    "image_name" TEXT,
    CONSTRAINT "images_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creators" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateIndex
CREATE UNIQUE INDEX "index_creators_on_twitter_system_id" ON "creators"("twitter_system_id");

-- CreateIndex
CREATE UNIQUE INDEX "index_images_on_storage_name" ON "images"("storage_name");

-- CreateIndex
CREATE UNIQUE INDEX "index_images_on_image_name" ON "images"("image_name");

-- CreateIndex
CREATE INDEX "index_images_on_creator_id_and_created_at" ON "images"("creator_id", "created_at");

-- CreateIndex
CREATE INDEX "index_images_on_creator_id" ON "images"("creator_id");

