import { type User, type InsertUser, type MediaItem, type InsertMediaItem, type MediaItemWithTagsAndCategories, type Tag, type InsertTag, type MediaItemTag, type InsertMediaItemTag, type Category, type InsertCategory, type MediaItemCategory, type InsertMediaItemCategory, type ApiOption, type InsertApiOption, type MediaSearchParams } from "@shared/schema.ts";
import { randomUUID } from "crypto";
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';
import * as schema from '@shared/schema.ts';
import { eq, and, desc, asc, like, inArray, sql } from 'drizzle-orm';

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Media Items
  getMediaItems(params: MediaSearchParams): Promise<{ items: MediaItemWithTagsAndCategories[], total: number }>;
  getMediaItem(id: string): Promise<MediaItemWithTagsAndCategories | undefined>;
  getMediaItemByUrl(url: string): Promise<MediaItem | undefined>;
  createMediaItem(item: InsertMediaItem): Promise<MediaItem>;
  updateMediaItem(id: string, updates: Partial<MediaItem>): Promise<MediaItem | undefined>;
  deleteMediaItem(id: string): Promise<boolean>;
  getDuplicateMediaItems(): Promise<Record<string, MediaItem[]>>;

  // Tags
  getTags(): Promise<Tag[]>;
  getTag(id: string): Promise<Tag | undefined>;
  getTagByName(name: string): Promise<Tag | undefined>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: string, updates: Partial<Tag>): Promise<Tag | undefined>;
  deleteTag(id: string): Promise<boolean>;

  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  getCategoryByName(name: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, updates: Partial<Category>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;

  // Media Item Tags
  addTagToMediaItem(mediaItemId: string, tagId: string): Promise<MediaItemTag>;
  removeTagFromMediaItem(mediaItemId: string, tagId:string): Promise<boolean>;
  getTagsForMediaItem(mediaItemId: string): Promise<Tag[]>;

  // Media Item Categories
  addCategoryToMediaItem(mediaItemId: string, categoryId: string): Promise<MediaItemCategory>;
  removeCategoryFromMediaItem(mediaItemId: string, categoryId: string): Promise<boolean>;
  getCategoriesForMediaItem(mediaItemId: string): Promise<Category[]>;

  // API Options
  getApiOptions(): Promise<ApiOption[]>;
  getApiOption(id: string): Promise<ApiOption | undefined>;
  getApiOptionByName(name: string): Promise<ApiOption | undefined>;
  createApiOption(option: InsertApiOption): Promise<ApiOption>;
  updateApiOption(id: string, updates: Partial<ApiOption>): Promise<ApiOption | undefined>;
  deleteApiOption(id: string): Promise<boolean>;
  close(): Promise<void>;
  initializeDatabase(): Promise<void>;
  getMedia(limit: number, offset: number): Promise<any[]>;
  addMedia(data: { url: string; title: string; status: string }): Promise<any>;
}

export class DrizzleStorage implements IStorage {
  private db;
  private sqlite;
  private dbPath: string; // Add dbPath property

  constructor(dbName: string = './tmp/cipherbox.db') {
    this.dbPath = dbName;
    this.sqlite = new Database(this.dbPath, { verbose: console.log });
    this.db = drizzle(this.sqlite, { schema, logger: true });
  }

  async close(): Promise<void> {
    // TODO: Implement database cleanup if needed
    console.log('Database connection closed');
  }

  // Implement all methods from IStorage using Drizzle ORM

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return await this.db.query.users.findFirst({ where: eq(schema.users.id, id) });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return await this.db.query.users.findFirst({ where: eq(schema.users.username, username) });
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const newUser = { ...insertUser, id };
    await this.db.insert(schema.users).values(newUser);
    return newUser;
  }

  // Media Items
  async getMediaItems(params: MediaSearchParams): Promise<{ items: MediaItemWithTagsAndCategories[], total: number }> {
    const { search, tags: tagFilter, categories: categoryFilter, type, sizeRange, page = 1, limit = 20 } = params;

    const qb = this.db.select()
      .from(schema.mediaItems);

    const countQb = this.db.select({
        count: sql<number>`count(DISTINCT ${schema.mediaItems.id})`
    }).from(schema.mediaItems);

    const conditions = [];

    if (tagFilter && tagFilter.length > 0) {
        qb.leftJoin(schema.mediaItemTags, eq(schema.mediaItems.id, schema.mediaItemTags.mediaItemId));
        countQb.leftJoin(schema.mediaItemTags, eq(schema.mediaItems.id, schema.mediaItemTags.mediaItemId));
        conditions.push(inArray(schema.mediaItemTags.tagId, this.db.select({ id: schema.tags.id }).from(schema.tags).where(inArray(schema.tags.name, tagFilter))));
    }

    if (categoryFilter && categoryFilter.length > 0 || search) {
        qb.leftJoin(schema.mediaItemCategories, eq(schema.mediaItems.id, schema.mediaItemCategories.mediaItemId))
          .leftJoin(schema.categories, eq(schema.mediaItemCategories.categoryId, schema.categories.id));
        countQb.leftJoin(schema.mediaItemCategories, eq(schema.mediaItems.id, schema.mediaItemCategories.mediaItemId))
          .leftJoin(schema.categories, eq(schema.mediaItemCategories.categoryId, schema.categories.id));
    }

    if (categoryFilter && categoryFilter.length > 0) {
        conditions.push(inArray(schema.categories.name, categoryFilter));
    }

    if (search) {
        conditions.push(sql`(${like(schema.mediaItems.title, `%${search}%`)} or ${like(schema.categories.name, `%${search}%`)})`);
    }

    if (type) {
        conditions.push(eq(schema.mediaItems.type, type));
    }

    if (sizeRange) {
        const sizeConditions = {
            small: sql`${schema.mediaItems.size} < ${100 * 1024 * 1024}`,
            medium: sql`${schema.mediaItems.size} >= ${100 * 1024 * 1024} AND ${schema.mediaItems.size} < ${1024 * 1024 * 1024}`,
            large: sql`${schema.mediaItems.size} >= ${1024 * 1024 * 1024}`,
        };
        if (sizeConditions[sizeRange]) {
            conditions.push(sizeConditions[sizeRange]);
        }
    }

    if (conditions.length > 0) {
        qb.where(and(...conditions));
        countQb.where(and(...conditions));
    }

    const items = await qb.groupBy(schema.mediaItems.id).limit(limit).offset((page - 1) * limit).orderBy(desc(schema.mediaItems.createdAt));

    const totalResult = await countQb;
    const total = totalResult[0].count;

    if (items.length === 0) {
        return { items: [], total };
    }

  const itemIds: string[] = items.map((item: any) => item.id);

    const tags = await this.db.query.mediaItemTags.findMany({
      where: inArray(schema.mediaItemTags.mediaItemId, itemIds as string[]),
      with: { tag: true }
    });

    const categories = await this.db.query.mediaItemCategories.findMany({
      where: inArray(schema.mediaItemCategories.mediaItemId, itemIds as string[]),
      with: { category: true }
    });

    const tagsByItemId: Record<string, Tag[]> = tags.reduce((acc: Record<string, Tag[]>, itemTag: any) => {
      const id = itemTag.mediaItemId as string;
      if (!acc[id]) acc[id] = [];
      acc[id].push(itemTag.tag);
      return acc;
    }, {});

    const categoriesByItemId: Record<string, Category[]> = categories.reduce((acc: Record<string, Category[]>, itemCategory: any) => {
      const id = itemCategory.mediaItemId as string;
      if (!acc[id]) acc[id] = [];
      acc[id].push(itemCategory.category);
      return acc;
    }, {});

    const itemsWithTagsAndCategories: MediaItemWithTagsAndCategories[] = items.map((item: any) => ({
      ...item,
      tags: tagsByItemId[item.id] || [],
      categories: categoriesByItemId[item.id] || []
    }));

    return { items: itemsWithTagsAndCategories, total };
  }

  async getMediaItem(id: string): Promise<MediaItemWithTagsAndCategories | undefined> {
    const result = await this.db.query.mediaItems.findFirst({
      where: eq(schema.mediaItems.id, id),
      with: {
        tags: { with: { tag: true } },
        categories: { with: { category: true } },
      },
    });

    if (!result) return undefined;

    return {
      ...result,
      tags: result.tags.map(t => t.tag),
      categories: result.categories.map(c => c.category),
    };
  }

  async getMediaItemByUrl(url: string): Promise<MediaItem | undefined> {
    return await this.db.query.mediaItems.findFirst({ where: eq(schema.mediaItems.url, url) });
  }

  async createMediaItem(insertItem: InsertMediaItem): Promise<MediaItem> {
    const id = randomUUID();
    // Ensure all required fields are present and not undefined
    const newItem: MediaItem = {
      id,
      url: insertItem.url,
      title: insertItem.title,
      description: insertItem.description ?? null,
      thumbnail: insertItem.thumbnail ?? null,
      type: insertItem.type ?? "video",
      duration: insertItem.duration ?? null,
      size: insertItem.size ?? null,
      downloadUrl: insertItem.downloadUrl ?? null,
      downloadExpiresAt: insertItem.downloadExpiresAt ?? null,
      downloadFetchedAt: insertItem.downloadFetchedAt ?? null,
      scrapedAt: insertItem.scrapedAt ?? null,
      error: insertItem.error ?? null,
      folderVideoCount: insertItem.folderVideoCount ?? 0,
      folderImageCount: insertItem.folderImageCount ?? 0,
      createdAt: new Date(),
    };
    await this.db.insert(schema.mediaItems).values(newItem);
    return newItem;
  }

  async updateMediaItem(id: string, updates: Partial<MediaItem>): Promise<MediaItem | undefined> {
    await this.db.update(schema.mediaItems).set(updates).where(eq(schema.mediaItems.id, id));
    return await this.getMediaItem(id);
  }

  async deleteMediaItem(id: string): Promise<boolean> {
    await this.db.delete(schema.mediaItems).where(eq(schema.mediaItems.id, id));
    return true;
  }

  async getDuplicateMediaItems(): Promise<Record<string, MediaItem[]>> {
    const duplicateUrlsQuery = this.db
      .select({ url: schema.mediaItems.url })
      .from(schema.mediaItems)
      .groupBy(schema.mediaItems.url)
      .having(sql`count(*) > 1`);

    const duplicateThumbnailsQuery = this.db
      .select({ thumbnail: schema.mediaItems.thumbnail })
      .from(schema.mediaItems)
      .where(sql`${schema.mediaItems.thumbnail} IS NOT NULL`)
      .groupBy(schema.mediaItems.thumbnail)
      .having(sql`count(*) > 1`);

    const [duplicateUrlRows, duplicateThumbnailRows] = await Promise.all([
      duplicateUrlsQuery,
      duplicateThumbnailsQuery,
    ]);

    const duplicateUrls = duplicateUrlRows.map(r => r.url);
    const duplicateThumbnails = duplicateThumbnailRows.map(r => r.thumbnail).filter(t => t !== null) as string[];

    if (duplicateUrls.length === 0 && duplicateThumbnails.length === 0) {
        return {};
    }

    const duplicateItems = await this.db.query.mediaItems.findMany({
        where: sql`(${inArray(schema.mediaItems.url, duplicateUrls)}) OR (${inArray(schema.mediaItems.thumbnail, duplicateThumbnails)})`,
        orderBy: [asc(schema.mediaItems.url), asc(schema.mediaItems.thumbnail), asc(schema.mediaItems.createdAt)],
    });

    // Group by both url and thumbnail, so items with same thumbnail (even if different url) are grouped together
    const grouped: Record<string, MediaItem[]> = {};
    for (const item of duplicateItems) {
      // Group by thumbnail if present, else by url
      const key = item.thumbnail || item.url || item.id;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }
    // Filter out groups with only one item
    Object.keys(grouped).forEach(key => {
      if (grouped[key].length < 2) {
        delete grouped[key];
      }
    });
    return grouped;
  }

  // Tags
  async getTags(): Promise<Tag[]> {
    return await this.db.query.tags.findMany({ orderBy: [asc(schema.tags.name)] });
  }

  async getTag(id: string): Promise<Tag | undefined> {
    return await this.db.query.tags.findFirst({ where: eq(schema.tags.id, id) });
  }

  async getTagByName(name: string): Promise<Tag | undefined> {
    return await this.db.query.tags.findFirst({ where: eq(schema.tags.name, name) });
  }

  async createTag(insertTag: InsertTag): Promise<Tag> {
    const id = randomUUID();
    const newTag: Tag = {
      id,
      name: insertTag.name,
      color: insertTag.color ?? "primary",
      createdAt: new Date(),
    };
    await this.db.insert(schema.tags).values(newTag);
    return newTag;
  }

  async updateTag(id: string, updates: Partial<Tag>): Promise<Tag | undefined> {
    await this.db.update(schema.tags).set(updates).where(eq(schema.tags.id, id));
    return await this.getTag(id);
  }

  async deleteTag(id: string): Promise<boolean> {
    await this.db.delete(schema.tags).where(eq(schema.tags.id, id));
    return true;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return await this.db.query.categories.findMany({ orderBy: [asc(schema.categories.name)] });
  }

  async getCategory(id: string): Promise<Category | undefined> {
    return await this.db.query.categories.findFirst({ where: eq(schema.categories.id, id) });
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    return await this.db.query.categories.findFirst({ where: eq(schema.categories.name, name) });
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = randomUUID();
    const newCategory = { ...insertCategory, id, createdAt: new Date() };
    await this.db.insert(schema.categories).values(newCategory);
    return newCategory;
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category | undefined> {
    await this.db.update(schema.categories).set(updates).where(eq(schema.categories.id, id));
    return await this.getCategory(id);
  }

  async deleteCategory(id: string): Promise<boolean> {
    await this.db.delete(schema.categories).where(eq(schema.categories.id, id));
    return true;
  }

  // Media Item Tags
  async addTagToMediaItem(mediaItemId: string, tagId: string): Promise<MediaItemTag> {
    const id = randomUUID();
    const newMediaItemTag = { id, mediaItemId, tagId };
    await this.db.insert(schema.mediaItemTags).values(newMediaItemTag);
    return newMediaItemTag;
  }

  async removeTagFromMediaItem(mediaItemId: string, tagId: string): Promise<boolean> {
    await this.db.delete(schema.mediaItemTags).where(and(eq(schema.mediaItemTags.mediaItemId, mediaItemId), eq(schema.mediaItemTags.tagId, tagId)));
    return true;
  }

  async getTagsForMediaItem(mediaItemId: string): Promise<Tag[]> {
    const mediaItemTags = await this.db.query.mediaItemTags.findMany({ where: eq(schema.mediaItemTags.mediaItemId, mediaItemId) });
    if (mediaItemTags.length === 0) return [];
    const tagIds = mediaItemTags.map(t => t.tagId);
    return await this.db.query.tags.findMany({ where: inArray(schema.tags.id, tagIds) });
  }

  // Media Item Categories
  async addCategoryToMediaItem(mediaItemId: string, categoryId: string): Promise<MediaItemCategory> {
    const id = randomUUID();
    const newMediaItemCategory = { id, mediaItemId, categoryId };
    await this.db.insert(schema.mediaItemCategories).values(newMediaItemCategory);
    return newMediaItemCategory;
  }

  async removeCategoryFromMediaItem(mediaItemId: string, categoryId: string): Promise<boolean> {
    await this.db.delete(schema.mediaItemCategories).where(and(eq(schema.mediaItemCategories.mediaItemId, mediaItemId), eq(schema.mediaItemCategories.categoryId, categoryId)));
    return true;
  }

  async getCategoriesForMediaItem(mediaItemId: string): Promise<Category[]> {
    const mediaItemCategories = await this.db.query.mediaItemCategories.findMany({ where: eq(schema.mediaItemCategories.mediaItemId, mediaItemId) });
    if (mediaItemCategories.length === 0) return [];
    const categoryIds = mediaItemCategories.map(c => c.categoryId);
    return await this.db.query.categories.findMany({ where: inArray(schema.categories.id, categoryIds) });
  }

  // API Options
  async getApiOptions(): Promise<ApiOption[]> {
    return await this.db.query.apiOptions.findMany({ orderBy: [asc(schema.apiOptions.name)] });
  }

  async getApiOption(id: string): Promise<ApiOption | undefined> {
    return await this.db.query.apiOptions.findFirst({ where: eq(schema.apiOptions.id, id) });
  }

  async getApiOptionByName(name: string): Promise<ApiOption | undefined> {
    return await this.db.query.apiOptions.findFirst({ where: eq(schema.apiOptions.name, name) });
  }

  async createApiOption(insertOption: InsertApiOption): Promise<ApiOption> {
    const id = randomUUID();
    const newOption: ApiOption = {
      id,
      url: insertOption.url,
      name: insertOption.name,
      field: insertOption.field,
      type: insertOption.type ?? "json",
      status: insertOption.status ?? "available",
      method: insertOption.method ?? "POST",
      isActive: insertOption.isActive ?? true,
    };
    await this.db.insert(schema.apiOptions).values(newOption);
    return newOption;
  }

  async updateApiOption(id: string, updates: Partial<ApiOption>): Promise<ApiOption | undefined> {
    await this.db.update(schema.apiOptions).set(updates).where(eq(schema.apiOptions.id, id));
    return await this.getApiOption(id);
  }

  async deleteApiOption(id: string): Promise<boolean> {
    await this.db.delete(schema.apiOptions).where(eq(schema.apiOptions.id, id));
    return true;
  }

  async initializeDatabase() {
    console.log('DrizzleStorage.initializeDatabase: start');

    try {
      // Execute each statement separately to avoid hanging
      const statements = [
        `CREATE TABLE IF NOT EXISTS media_items (
          id TEXT PRIMARY KEY,
          url TEXT UNIQUE NOT NULL,
          title TEXT,
          description TEXT,
          thumbnail TEXT,
          duration INTEGER,
          size INTEGER,
          type TEXT DEFAULT 'video',
          download_url TEXT,
          download_expires_at DATETIME,
          download_fetched_at DATETIME,
          error TEXT,
          scraped_at DATETIME,
          folder_video_count INTEGER DEFAULT 0,
          folder_image_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          color TEXT DEFAULT 'primary',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS media_item_tags (
          id TEXT PRIMARY KEY,
          media_item_id TEXT,
          tag_id TEXT,
          FOREIGN KEY (media_item_id) REFERENCES media_items(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS media_item_categories (
          id TEXT PRIMARY KEY,
          media_item_id TEXT,
          category_id TEXT,
          FOREIGN KEY (media_item_id) REFERENCES media_items(id) ON DELETE CASCADE,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS api_options (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          url TEXT NOT NULL,
          method TEXT DEFAULT 'POST',
          type TEXT DEFAULT 'json',
          field TEXT DEFAULT 'url',
          status TEXT DEFAULT 'available',
          is_active BOOLEAN DEFAULT true,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      ];

      // Execute CREATE TABLE statements
      for (const statement of statements) {
        this.sqlite.exec(statement);
      }

      // Insert default API options
      const insertStatement = this.sqlite.prepare(`
        INSERT OR IGNORE INTO api_options (id, name, url, method, type, field) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const defaultApiOptions = [
        ['playertera', 'PlayerTera', '/api/playertera-proxy', 'POST', 'json', 'url'],
        ['tera-fast', 'TeraFast', '/api/tera-fast-proxy', 'GET', 'query', 'url'],
        ['teradwn', 'TeraDownloadr', '/api/teradwn-proxy', 'POST', 'json', 'link'],
        ['iteraplay', 'IteraPlay', '/api/iteraplay-proxy', 'POST', 'json', 'link'],
        ['raspywave', 'RaspyWave', '/api/raspywave-proxy', 'POST', 'json', 'link'],
        ['rapidapi', 'RapidAPI', '/api/rapidapi-proxy', 'POST', 'json', 'link'],
        ['tera-downloader-cc', 'Tera Downloader CC', '/api/tera-downloader-cc-proxy', 'POST', 'json', 'url']
      ];

      for (const option of defaultApiOptions) {
        insertStatement.run(...option);
      }

      console.log('DrizzleStorage.initializeDatabase: tables created');

    } catch (error) {
      console.error('DrizzleStorage.initializeDatabase: error during table creation or data insertion', error);
      throw error;
    }

    console.log('DrizzleStorage.initializeDatabase: end');
  }

  async getMedia(limit: number, offset: number): Promise<any[]> {
    // TODO: Implement actual database query
    console.log(`Getting ${limit} media items with offset ${offset}`);
    return [];
  }

  async addMedia(data: { url: string; title: string; status: string }): Promise<any> {
    // TODO: Implement actual database insertion
    console.log('Adding media:', data);
    return { id: Date.now(), ...data };
  }
}