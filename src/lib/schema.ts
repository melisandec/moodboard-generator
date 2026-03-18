import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  fid: text("fid").primaryKey(),
  username: text("username"),
  pfpUrl: text("pfp_url"),
  bio: text("bio").default(""),
  socialLinks: text("social_links", { mode: "json" })
    .notNull()
    .$type<Record<string, string>>(),
  followerCount: integer("follower_count").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
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
    primaryCategory: text("primary_category").default("Uncategorized"), // Main category for filtering
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
    remixCount: integer("remix_count").default(0), // Aggregate remix count
    likeCount: integer("like_count").default(0), // Aggregate like count from reactions
    lastRemixAt: integer("last_remix_at", { mode: "timestamp" }),
    remixOfId: text("remix_of_id"),
    mintTxHash: text("mint_tx_hash"),
    mintContractAddress: text("mint_contract_address"),
    folderId: text("folder_id").references(() => folders.id),
    previewUrl: text("preview_url"),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    syncVersion: integer("sync_version").notNull().default(1),
  },
  (table) => [
    index("moodboards_fid_idx").on(table.fid),
    index("moodboards_category_idx").on(table.fid, table.primaryCategory),
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

export const folders = sqliteTable(
  "folders",
  {
    id: text("id").primaryKey(),
    fid: text("fid")
      .notNull()
      .references(() => users.fid),
    name: text("name").notNull(),
    description: text("description").default(""),
    isPublic: integer("is_public", { mode: "boolean" }).default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("folders_fid_idx").on(table.fid),
    index("folders_public_idx").on(table.isPublic),
  ],
);

export const reactions = sqliteTable(
  "reactions",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => moodboards.id),
    fid: text("fid")
      .notNull()
      .references(() => users.fid),
    emoji: text("emoji").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("reactions_board_idx").on(table.boardId),
    index("reactions_fid_idx").on(table.fid),
    index("reactions_emoji_idx").on(table.boardId, table.emoji),
  ],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => moodboards.id),
    fid: text("fid")
      .notNull()
      .references(() => users.fid),
    text: text("text").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("comments_board_idx").on(table.boardId),
    index("comments_fid_idx").on(table.fid),
  ],
);

export const userStats = sqliteTable("user_stats", {
  fid: text("fid")
    .primaryKey()
    .references(() => users.fid),
  totalBoardsPublished: integer("total_boards_published").default(0),
  totalViews: integer("total_views").default(0),
  totalRemixes: integer("total_remixes").default(0),
  mostRemixedBoardId: text("most_remixed_board_id"),
  thisMonthViews: integer("this_month_views").default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const activities = sqliteTable(
  "activities",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(), // e.g. created, modified, remixed, viewed
    boardId: text("board_id").references(() => moodboards.id),
    fid: text("fid").references(() => users.fid),
    details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("activities_board_idx").on(t.boardId),
    index("activities_fid_idx").on(t.fid),
    index("activities_type_idx").on(t.type),
  ],
);

// Phase 6: User Favorites
export const favorites = sqliteTable(
  "favorites",
  {
    id: text("id").primaryKey(),
    fid: text("fid")
      .notNull()
      .references(() => users.fid),
    boardId: text("board_id")
      .notNull()
      .references(() => moodboards.id),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("favorites_fid_idx").on(table.fid),
    index("favorites_board_idx").on(table.boardId),
    index("favorites_fid_board_idx").on(table.fid, table.boardId),
  ],
);

// Phase 6: User Collections
export const collections = sqliteTable(
  "collections",
  {
    id: text("id").primaryKey(),
    fid: text("fid")
      .notNull()
      .references(() => users.fid),
    name: text("name").notNull(),
    description: text("description").default(""),
    isPublic: integer("is_public", { mode: "boolean" }).default(false),
    coverBoardId: text("cover_board_id").references(() => moodboards.id),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("collections_fid_idx").on(table.fid),
    index("collections_public_idx").on(table.isPublic),
  ],
);

// Phase 6: Collection Items
export const collectionItems = sqliteTable(
  "collection_items",
  {
    id: text("id").primaryKey(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id),
    boardId: text("board_id")
      .notNull()
      .references(() => moodboards.id),
    order: integer("order").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("collection_items_collection_idx").on(table.collectionId),
    index("collection_items_board_idx").on(table.boardId),
  ],
);

// Phase 6: Remix Relationships for Attribution
export const remixRelationships = sqliteTable(
  "remix_relationships",
  {
    id: text("id").primaryKey(),
    remixBoardId: text("remix_board_id")
      .notNull()
      .references(() => moodboards.id),
    originalBoardId: text("original_board_id")
      .notNull()
      .references(() => moodboards.id),
    creatorFid: text("creator_fid").references(() => users.fid),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("remix_relationships_remix_idx").on(table.remixBoardId),
    index("remix_relationships_original_idx").on(table.originalBoardId),
    index("remix_relationships_creator_idx").on(table.creatorFid),
  ],
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
