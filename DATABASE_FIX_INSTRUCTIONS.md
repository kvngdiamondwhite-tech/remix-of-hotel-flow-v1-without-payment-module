# Database Fix - Important Instructions

## What was fixed:
The database issue was caused by a conflict in version management between `db.ts` and `payments.ts`. The payments store initialization was trying to dynamically increment the database version and close/reopen the connection, which caused the database connection to become invalid for subsequent operations.

## The Solution:
1. **Moved payments store creation** from dynamic runtime initialization to the main database schema initialization in `db.ts`
2. **Updated DB_VERSION** from 1000 to 1001 to trigger the schema upgrade
3. **Simplified initPaymentsStore()** in `payments.ts` to just ensure the database is initialized

## To Apply the Fix:

### Option 1: Automatic (Easiest)
1. Open the browser's Developer Tools (F12)
2. Go to the **Application** tab
3. Find **IndexedDB** in the left sidebar
4. Expand it and find **HotelManagementDB**
5. Delete the **HotelManagementDB** database
6. Refresh the browser page (F5)
7. The database will be recreated with the new schema automatically

### Option 2: Using Browser Console
1. Open the browser console (F12)
2. Run this command:
```javascript
// Clear the old database
const deleteReq = indexedDB.deleteDatabase('HotelManagementDB');
deleteReq.onsuccess = () => console.log('Database deleted successfully');
deleteReq.onerror = () => console.log('Error deleting database');
```
3. Refresh the page
4. The database will be recreated with the new schema

### Option 3: Via Code (if needed)
If you need to do this programmatically, add this to your app initialization:
```typescript
// Only run once to clear old database
const clearOldDB = async () => {
  return new Promise((resolve, reject) => {
    const deleteReq = indexedDB.deleteDatabase('HotelManagementDB');
    deleteReq.onsuccess = () => resolve(true);
    deleteReq.onerror = () => reject(deleteReq.error);
  });
};
```

## After Clearing the Database:
1. Refresh your browser
2. The application will automatically recreate the database with the correct schema (including the payments store)
3. You should now be able to add data without issues

## What Changed in the Code:
- **src/lib/db.ts**: Added payments store to main schema, bumped DB_VERSION to 1001
- **src/lib/payments.ts**: Removed dynamic version increment logic, now uses main database initialization

## Testing:
After applying the fix:
1. Try adding a new Room Type
2. Try adding a new Guest
3. Try adding a new Booking
4. Try recording a Payment

All operations should work without errors now.
