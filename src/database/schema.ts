import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const apiKeyTable = pgTable('api_key', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});
