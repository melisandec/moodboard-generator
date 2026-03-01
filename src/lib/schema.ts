import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  fid: text("fid").primaryKey(),
  username: text("username"),
  pfpUrl: text("pfp_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const moodboards = sqliteTable(
  "moodboards",
  {
    id: text("id").primaryKey(),
    fid: text("fid")
      .notNull()
      .references(() => users.fid),
    title: text("title").notNull(),
    caption: text("caption").default(""),
    categories: text("categories", { mode: "json" })
      .notNull()
      .$type<string[]>(),
    canvasState: text("canvas_state", { mode: "json" })
      .notNull()
      .$type<CloudCanvasImage[]>(),
    canvasWidth: integer("canvas_width").notNull(),
    canvasHeight: integer("canvas_height").notNull(),
    background: text("background").default("#f5f5f4"),
    orientation: text("orientation").default("portrait"),
    margin: integer("margin", { mode: "boolean" }).default(false),
    pinned: integer("pinned", { mode: "boolean" }).default(false),
    isPublic: integer("is_public", { mode: "boolean" }).default(false),
    editHistory: text("edit_history", { mode: "json" })
      .$type<EditHistoryEntry[]>()
      .default([]),
    viewCount: integer("view_count").default(0),
    editCount: integer("edit_count").default(0),
    lastRemixAt: integer("last_remix_at", { mode: "timestamp" }),
    remixOfId: text("remix_of_id"),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    syncVersion: integer("sync_version").notNull().default(1),
  },
  (table) => [
    index("moodboards_fid_idx").on(table.fid),
    index("moodboards_updated_idx").on(table.fid, table.updatedAt),
    index("moodboards_public_idx").on(table.isPublic, table.updatedAt),
    index("moodboards_public_views_idx").on(table.isPublic, table.viewCount),
    index("moodboards_public_published_idx").on(
      table.isPublic,
      table.publishedAt,
    ),
  ],
);

export const images = sqliteTable(
  "images",
  {
    hash: text("hash").primaryKey(),
    fid: text("fid")
      .notNull()
      .references(() => users.fid),
    url: text("url").notNull(),
    filename: text("filename").default(""),
    naturalWidth: integer("natural_width").notNull(),
    naturalHeight: integer("natural_height").notNull(),
    tags: text("tags", { mode: "json" }).notNull().$type<string[]>(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("images_fid_idx").on(table.fid)],
);

export interface EditHistoryEntry {
  fid: string;
  username: string;
  editedAt: string;
}

export interface CloudCanvasImage {
  id: string;
  imageHash: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  pinned: boolean;
  zIndex: number;
  naturalWidth: number;
  naturalHeight: number;
}
