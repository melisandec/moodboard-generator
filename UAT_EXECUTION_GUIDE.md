# User Acceptance Testing (UAT) Execution Guide

## Overview
This document provides step-by-step instructions for executing comprehensive User Acceptance Testing on the Moodboard Generator dashboard improvements.

**Target Environment**: Staging (https://moodboard-generator-staging.vercel.app)  
**Duration**: ~90 minutes for complete UAT  
**Prerequisites**: Access to staging environment + test user account

---

## Test Environment Setup

### 1. Access Staging Environment
```
URL: https://moodboard-generator-staging.vercel.app
- Sign in with Farcaster
- Navigate to Dashboard
```

### 2. Prepare Test Data
Before starting UAT:
- Create 3-5 test boards with different categories
- Ensure some boards have existing views/remixes/likes
- Create test boards in different time periods for time-filter testing

---

## Test Scenarios

### Module 1: Search & Discovery (15 mins)

#### Test 1.1: Basic Text Search
**Steps**:
1. Navigate to Dashboard
2. Click on SearchBar component
3. Type "test" in search field
4. Verify results display boards containing "test"
5. Click on a result to view board

**Expected**: ✅ Search returns relevant results within 500ms

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 1.2: Search by Caption
**Steps**:
1. Search for text that appears in board captions only
2. Verify boards with matching captions appear
3. Verify caption snippet visible in results

**Expected**: ✅ Caption search functional

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 1.3: Sort - Newest First
**Steps**:
1. Enter search query
2. Select "Sort: Newest"
3. Note first 3 board timestamps
4. Verify timestamp order is descending (newest first)

**Expected**: ✅ Boards ordered by creation date, newest first

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 1.4: Sort - Most Views
**Steps**:
1. Search for common term
2. Select "Sort: Views"
3. Note view counts of top 3 results
4. Verify counts are in descending order

**Expected**: ✅ Boards ordered by view_count, highest first

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 1.5: Sort - Most Remixed
**Steps**:
1. Execute search
2. Select "Sort: Remixes"
3. Verify top results have highest remix_count values

**Expected**: ✅ Correct sort by remix_count

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 1.6: Sort - Most Liked
**Steps**:
1. Execute search
2. Select "Sort: Likes"
3. Verify top results have highest like_count values

**Expected**: ✅ Correct sort by like_count

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 1.7: Time Filter - All Time
**Steps**:
1. Search with "All" time filter
2. Note oldest board in results
3. Verify boards are older than 1 year
4. Verify count matches unfiltered results

**Expected**: ✅ Shows all historical boards

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 1.8: Time Filter - Last Week
**Steps**:
1. Search with "Week" time filter
2. Note oldest board timestamp
3. Verify all boards created within last 7 days
4. Verify count is <= all-time count

**Expected**: ✅ Only boards from last 7 days

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 1.9: Time Filter - Last Month
**Steps**:
1. Search with "Month" time filter
2. Verify all board createdAt from last 30 days
3. Compare result count with all-time

**Expected**: ✅ Only boards from last 30 days

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 1.10: Time Filter - Last Year
**Steps**:
1. Search with "Year" time filter
2. Verify all boards from last 365 days
3. Compare with all-time results

**Expected**: ✅ Only boards from last 365 days

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

### Module 2: Trending & Analytics (20 mins)

#### Test 2.1: Trending Boards Display
**Steps**:
1. Navigate to Dashboard
2. Locate Trending Boards section
3. Verify 12 boards display in grid
4. Click on trending board
5. Verify creator attribution visible

**Expected**: ✅ Trending boards display with creator info

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 2.2: Analytics Panel Stats
**Steps**:
1. Open Analytics Panel
2. Verify displays 5 key statistics:
   - Published
   - Views
   - Remixes
   - Likes
   - This Month
3. Note each value

**Expected**: ✅ All 5 stats visible and populated

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________
- Published: ___
- Views: ___
- Remixes: ___
- Likes: ___
- This Month: ___

---

#### Test 2.3: Analytics Accuracy
**Steps**:
1. Open Analytics Panel
2. Manually count published boards
3. Compare with "Published" stat
4. Check if /api/user/analytics endpoint data matches

**Expected**: ✅ Stats match database

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 2.4: Top Board Identification
**Steps**:
1. Open Analytics Panel
2. Note top board name
3. Query database for board with highest view_count
4. Verify match

**Expected**: ✅ Top board correctly identified

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 2.5: This Month Stat
**Steps**:
1. Open Analytics Panel
2. Note "This Month" value
3. Count boards created in current month
4. Verify engagement matches

**Expected**: ✅ Current month data accurate

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

### Module 3: Favorites (15 mins)

#### Test 3.1: Add Favorite
**Steps**:
1. Navigate to board preview
2. Click "Add to Favorites" button
3. Verify confirmation
4. Check Favorites Panel updates

**Expected**: ✅ Board added to favorites

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 3.2: Remove Favorite
**Steps**:
1. Open Favorites Panel
2. Click "Remove" on favorited board
3. Verify removal confirmation
4. Refresh page and verify persists

**Expected**: ✅ Board removed from favorites

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 3.3: Duplicate Favorite Prevention
**Steps**:
1. Add board to favorites
2. Try to add same board again
3. Verify error message appears

**Expected**: ✅ Error: "Already favorited"

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 3.4: Favorites Pagination
**Steps**:
1. Add 25+ boards to favorites
2. Open Favorites Panel
3. Verify pagination controls appear
4. Navigate to page 2
5. Verify different boards display

**Expected**: ✅ Pagination functional with 20 per page

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 3.5: Favorites Empty State
**Steps**:
1. Clear all favorites (if any exist)
2. Open Favorites Panel
3. Verify empty state message

**Expected**: ✅ Empty state displays: "No favorite boards yet"

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

### Module 4: Collections (20 mins)

#### Test 4.1: Create Collection
**Steps**:
1. Open Collections Panel
2. Click "Create Collection"
3. Enter name: "Test Collection 1"
4. Enter description: "Test Description"
5. Set to private
6. Click Create

**Expected**: ✅ Collection created and displays in list

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 4.2: Update Collection
**Steps**:
1. Click on created collection
2. Edit name to "Updated Collection"
3. Change to public
4. Save
5. Verify changes persist on refresh

**Expected**: ✅ Collection updated successfully

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 4.3: Add Board to Collection
**Steps**:
1. Open collection
2. Click "Add Board"
3. Search and select a board
4. Verify board appears in collection
5. Note order (should be auto-ordered)

**Expected**: ✅ Board added with auto-ordering

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 4.4: Add Multiple Boards
**Steps**:
1. Add 5 boards to collection
2. Verify all 5 display
3. Verify order is: 1, 2, 3, 4, 5

**Expected**: ✅ Multiple boards track order correctly

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 4.5: Remove Board from Collection
**Steps**:
1. In collection, use context menu to remove a board
2. Verify board removed from list
3. Verify remaining boards reorder correctly

**Expected**: ✅ Board removed and reordering works

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 4.6: Delete Collection
**Steps**:
1. Create a collection with items
2. Click delete on collection
3. Confirm deletion
4. Verify collection removed
5. Verify items cascade deleted

**Expected**: ✅ Collection and all items deleted

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 4.7: Collection Privacy
**Steps**:
1. Create public collection
2. Get share link
3. Open in incognito/different user
4. Verify public collection is visible

**Expected**: ✅ Public collections visible to others

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 4.8: Collection Privacy - Private
**Steps**:
1. Create private collection
2. Try to access with different user
3. Verify 404 or access denied

**Expected**: ✅ Private collections hidden from others

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

### Module 5: Remix Attribution (15 mins)

#### Test 5.1: Remix Tracking
**Steps**:
1. Create a board (Board A)
2. Remix Board A to create Board B
3. Navigate to Board A details
4. Click "Remixes" tab
5. Verify Board B appears in remix history

**Expected**: ✅ Remix relationship tracked and visible

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 5.2: Remix Creator Attribution
**Steps**:
1. In remixes list
2. Verify creator FID/username shows
3. Verify links to creator profile or board

**Expected**: ✅ Creator attribution accurate

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 5.3: Multiple Remixes
**Steps**:
1. Create Board A
2. Remix A twice (create B and C)
3. In Board A remixes tab
4. Verify both B and C appear

**Expected**: ✅ Multiple remixes tracked correctly

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 5.4: Remix Timestamp
**Steps**:
1. View remixes for a board
2. Verify timestamps are recent/accurate
3. Verify most recent remix at top

**Expected**: ✅ Timestamps accurate and ordered

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

### Module 6: Activity Logging (10 mins)

#### Test 6.1: Collection Activity Logging
**Steps**:
1. Create, update, and delete a collection
2. Query activities table (or view activity log if exposed)
3. Verify entries for:
   - collection_created
   - collection_updated
   - collection_deleted

**Expected**: ✅ All collection operations logged

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 6.2: Favorites Activity Logging
**Steps**:
1. Add and remove a favorite
2. Check activities table
3. Verify favorite_added and favorite_removed logged

**Expected**: ✅ Favorite operations logged

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 6.3: Items Activity Logging
**Steps**:
1. Add and remove items from collection
2. Check activities
3. Verify item_added and item_removed logged

**Expected**: ✅ Item operations logged

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

### Module 7: Performance (10 mins)

#### Test 7.1: Search Response Time
**Steps**:
1. Open browser DevTools (Network tab)
2. Execute search
3. Note API response time
4. Repeat 3 times

**Expected**: ✅ Response time < 500ms

**Test Result**: [ ] Pass [ ] Fail  
**Response Times**: 
- Attempt 1: ___ ms
- Attempt 2: ___ ms
- Attempt 3: ___ ms

---

#### Test 7.2: Analytics Response Time
**Steps**:
1. Open DevTools Network tab
2. Open Analytics Panel
3. Note /api/user/analytics response time

**Expected**: ✅ Response time < 1000ms

**Test Result**: [ ] Pass [ ] Fail  
**Response Time**: ___ ms

---

#### Test 7.3: Collections Response Time
**Steps**:
1. DevTools Network tab
2. Create collection
3. Add item to collection
4. Verify response times < 300ms

**Expected**: ✅ Collection operations < 300ms

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

### Module 8: UI/UX (10 mins)

#### Test 8.1: Mobile Responsiveness
**Steps**:
1. Open Dashboard on mobile device (or zoom to 375px)
2. Test all new components:
   - SearchBar
   - AnalyticsPanel
   - TrendingBoards
   - CollectionsPanel
   - FavoritesPanel
3. Verify no horizontal scroll
4. Verify buttons are clickable/tappable

**Expected**: ✅ All responsive on mobile

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 8.2: Accessibility
**Steps**:
1. Use keyboard navigation only (Tab, Enter, Escape)
2. Navigate through all new components
3. Enable screen reader mode
4. Verify labels and aria attributes

**Expected**: ✅ Fully keyboard accessible

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

#### Test 8.3: Error States
**Steps**:
1. Try invalid operations (missing params, unauthorized)
2. Verify error messages display
3. Verify error messages are helpful
4. Verify no crashes occur

**Expected**: ✅ Graceful error handling

**Test Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

## UAT Summary

**Total Tests**: 51  
**Passed**: ___  
**Failed**: ___  
**Pass Rate**: ___%

### Critical Issues Found
(List any blocking issues)
1. _______________________
2. _______________________
3. _______________________

### Non-Critical Issues Found
(List nice-to-fix items)
1. _______________________
2. _______________________
3. _______________________

### Recommendation
[ ] ✅ **APPROVED** - Ready for production deployment  
[ ] 🔄 **CONDITIONAL** - Ready after critical issues fixed  
[ ] ❌ **REJECTED** - Major issues require rework

**Tested By**: _______________________  
**Date**: _______________________  
**Notes**: _______________________

---

## Sign-Off

**UAT Lead Approval**: _________________ **Date**: _______  
**Product Owner Approval**: _________________ **Date**: _______  
**Dev Lead Approval**: _________________ **Date**: _______

---

**Next Steps After UAT**:
1. Fix any critical issues found
2. Retest fixed functionality
3. Deploy to production
4. Monitor for 24 hours
5. Release notes to users
