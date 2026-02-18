import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  fid: text('fid').primaryKey(),
  username: text('username'),
  pfpUrl: text('pfp_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const moodboards = sqliteTable('moodboards', {
  id: text('id').primaryKey(),
  fid: text('fid').notNull().references(() => users.fid),
  title: text('title').notNull(),
  caption: text('caption').default(''),
  categories: text('categories', { mode: 'json' }).notNull().$type<string[]>(),
  canvasState: text('canvas_state', { mode: 'json' }).notNull().$type<CloudCanvasImage[]>(),
  canvasWidth: integer('canvas_width').notNull(),
  canvasHeight: integer('canvas_height').notNull(),
  background: text('background').default('#f5f5f4'),
  orientation: text('orientation').default('portrait'),
  margin: integer('margin', { mode: 'boolean' }).default(false),
  pinned: integer('pinned', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  syncVersion: integer('sync_version').notNull().default(1),
});

export const images = sqliteTable('images', {
  hash: text('hash').primaryKey(),
  fid: text('fid').notNull().references(() => users.fid),
  url: text('url').notNull(),
  filename: text('filename').default(''),
  naturalWidth: integer('natural_width').notNull(),
  naturalHeight: integer('natural_height').notNull(),
  tags: text('tags', { mode: 'json' }).notNull().$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

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
