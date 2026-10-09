import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const enquiries=sqliteTable('enquiries',{id:text('id').primaryKey(),name:text('name').notNull(),email:text('email').notNull(),clinic:text('clinic').notNull(),phone:text('phone').notNull(),interest:text('interest').notNull(),createdAt:integer('created_at').notNull()},t=>[index('idx_enquiries_created').on(t.createdAt,t.id)]);
export const admin=sqliteTable('admin',{id:integer('id').primaryKey(),passwordHash:text('password_hash').notNull()});
export const sessions=sqliteTable('sessions',{tokenHash:text('token_hash').primaryKey(),expiresAt:integer('expires_at').notNull()});
export const limits=sqliteTable('limits',{key:text('key').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull()});
