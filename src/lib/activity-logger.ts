/**
 * Activity tracking utilities for collections and social features
 * Integrates with the activity log system for audit trail and analytics
 */

import { getDb } from '@/lib/db';
import { activities } from '@/lib/schema';
import { v4 } from 'uuid';

interface ActivityLogOptions {
  type: 'collection_created' | 'collection_updated' | 'collection_deleted' | 
         'item_added' | 'item_removed' | 'favorite_added' | 'favorite_removed' |
         'remix_created';
  fid: string;
  boardId?: string;
  collectionId?: string;
  details?: Record<string, unknown>;
}

/**
 * Log an activity event for collections or social features
 */
export async function logCollectionActivity(options: ActivityLogOptions) {
  try {
    const db = getDb();
    
    // Map collection activities to generic activity types for compatibility
    const typeMapping: Record<string, string> = {
      collection_created: 'modified',
      collection_updated: 'modified',
      collection_deleted: 'modified',
      item_added: 'modified',
      item_removed: 'modified',
      favorite_added: 'liked',
      favorite_removed: 'modified',
      remix_created: 'remixed',
    };

    await db.insert(activities).values({
      id: v4(),
      type: typeMapping[options.type] || options.type,
      fid: options.fid,
      boardId: options.boardId || null,
      details: {
        eventType: options.type,
        collectionId: options.collectionId,
        ...options.details,
      },
      createdAt: new Date(),
    });

    console.log(`✓ Activity logged: ${options.type}`);
    return true;
  } catch (error) {
    console.error('Failed to log activity:', error);
    return false;
  }
}

/**
 * Batch log multiple activities
 */
export async function logActivitiesBatch(
  activities: ActivityLogOptions[]
) {
  const results = await Promise.all(
    activities.map(activity => logCollectionActivity(activity))
  );
  
  const successful = results.filter(r => r).length;
  console.log(`✓ Logged ${successful}/${activities.length} activities`);
  
  return successful === activities.length;
}
