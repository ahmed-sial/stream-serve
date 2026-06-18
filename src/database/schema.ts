import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const apiKeyTable = pgTable('api_key', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const playlistTable = pgTable('playlist', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  limit: integer('limit').default(10).notNull(),
  totalVideos: integer('total_videos').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});
