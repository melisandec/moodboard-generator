#!/usr/bin/env node
/**
 * Backfill script for Phase 4-6 schema changes
 * - Populates primaryCategory for existing boards
 * - Calculates and updates remixCount from activities
 * - Calculates and updates likeCount from reactions
 */

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import {
  moodboards,
  activities,
  reactions,
} from '../src/lib/schema';
import {
  eq,
  count,
  inArray,
} from 'drizzle-orm';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client);

async function backfill() {
  console.log('🔄 Starting backfill process...');

  try {
    // 1. Populate primaryCategory for boards without one
    console.log('\n📋 Step 1: Setting primaryCategory for boards...');
    const boardsWithoutCategory = await db
      .select({ id: moodboards.id })
      .from(moodboards)
      .where(
        eq(moodboards.primaryCategory, 'Uncategorized')
      );

    console.log(`   Found ${boardsWithoutCategory.length} boards without category`);
    
    // For now, set all to "Uncategorized" (in production, could use ML or analyze descriptions)
    if (boardsWithoutCategory.length > 0) {
      // Update in batches of 100
      for (let i = 0; i < boardsWithoutCategory.length; i += 100) {
        const batch = boardsWithoutCategory.slice(i, i + 100);
        const ids = batch.map(b => b.id);
        
        await db
          .update(moodboards)
          .set({ primaryCategory: 'Uncategorized' })
          .where(inArray(moodboards.id, ids));
        
        console.log(`   ✓ Updated batch ${Math.floor(i / 100) + 1}`);
      }
    } else {
      console.log('   ✓ All boards have categories');
    }

    // 2. Calculate remixCount from activities
    console.log('\n🔄 Step 2: Calculating remixCount from activities...');
    const allBoards = await db.select({ id: moodboards.id }).from(moodboards);
    
    let updated = 0;
    for (const board of allBoards) {
      const remixesResult = await db
        .select({ count: count() })
        .from(activities)
        .where(
          eq(activities.boardId, board.id)
        )
        .where(eq(activities.type, 'remixed'));
      
      const remixCount = remixesResult[0]?.count || 0;
      
      if (remixCount > 0) {
        await db
          .update(moodboards)
          .set({ remixCount })
          .where(eq(moodboards.id, board.id));
        updated++;
      }
    }
    console.log(`   ✓ Updated ${updated} boards with remix counts`);

    // 3. Calculate likeCount from reactions
    console.log('\n❤️  Step 3: Calculating likeCount from reactions...');
    updated = 0;
    for (const board of allBoards) {
      const likesResult = await db
        .select({ count: count() })
        .from(reactions)
        .where(eq(reactions.boardId, board.id));
      
      const likeCount = likesResult[0]?.count || 0;
      
      if (likeCount > 0) {
        await db
          .update(moodboards)
          .set({ likeCount })
          .where(eq(moodboards.id, board.id));
        updated++;
      }
    }
    console.log(`   ✓ Updated ${updated} boards with like counts`);

    console.log('\n✅ Backfill completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

backfill();
