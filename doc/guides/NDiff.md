# NDiff - CSpec Change Tracking System

## Table of Contents
1. [Quick Start](#quick-start)
2. [Overview](#overview)
3. [Architecture](#architecture)
4. [Key Concepts](#key-concepts)
5. [How It Works](#how-it-works)
6. [Usage](#usage)
7. [UI Components](#ui-components)
8. [Gotchas](#gotchas)

---

## Quick Start

To enable NDiff for a DAO, add `.setNdiff(true)` in your services.jrl:

```
return new foam.dao.EasyDAO.Builder(x)
  .setNdiff(true)
  .setJournalName("mydata")
  .setOf(com.example.MyModel.getOwnClassInfo())
  .build();
```

Once enabled, access **Admin > NDiffs** to view changed objects.

---

## Overview

### What It Does

NDiff is a debugging and tracking system for changes to CSpecs (Component Specifications) in FOAM3. It captures the initial state of objects loaded from repository journals (`.0` files) and compares them to their current runtime state, enabling developers to:

- Track when and how CSpec data has been modified during execution
- Identify objects that were deleted at runtime
- Compare before/after states visually
- Restore objects to their original state

### Key Files

| File | Purpose |
|------|---------|
| `foam3/src/foam/core/ndiff/NDiff.js` | Data model storing comparison data |
| `foam3/src/foam/core/ndiff/NDiffDAO.js` | DAO decorator that intercepts puts and logs changes |
| `foam3/src/foam/core/ndiff/NDiffRuntimeDAO.js` | Processes NDiff records at runtime with filtering |
| `foam3/src/foam/core/ndiff/NDiffJournal.js` | Journal wrapper integrating NDiff into replay pipeline |
| `foam3/src/foam/core/ndiff/services.jrl` | Service configuration for ndiffDAO |
| `foam3/src/foam/core/ndiff/menus.jrl` | Admin UI menu configuration |
| `foam3/src/foam/u2/view/ComparisonView.js` | Side-by-side comparison UI |

---

## Architecture

```
+-------------------------------------------------------------------------+
|                         NDiff System Architecture                        |
+-------------------------------------------------------------------------+
|                                                                          |
|  +---------------------------------------------------------------------+ |
|  |                        JDAO (Journal DAO)                           | |
|  |  +-----------------------+    +----------------------------+        | |
|  |  |   Repo Journal (.0)   |    |    Runtime Journal          |       | |
|  |  |                       |    |                              |       | |
|  |  |  NDiffJournal         |    |  NDiffJournal                |       | |
|  |  |  (runtimeOrigin=false)|    |  (runtimeOrigin=true)        |       | |
|  |  +-----------+-----------+    +-------------+----------------+       | |
|  |              |                               |                       | |
|  +--------------|-------------------------------|------------------------+ |
|                 |                               |                         |
|                 v                               v                         |
|  +----------------------------------------------------------------------+ |
|  |                          NDiffDAO                                     | |
|  |   Wraps delegate DAO during replay                                    | |
|  |   Records initialFObject for each put()                               | |
|  |   Only records from repo journal (runtimeOrigin=false)                | |
|  +----------------------------------+-----------------------------------+ |
|                                     |                                     |
|                                     v                                     |
|  +----------------------------------------------------------------------+ |
|  |                         ndiffDAO Service                              | |
|  |  +------------------------------------------------------------------+ | |
|  |  |                    NDiffRuntimeDAO                                | | |
|  |  |  - Filters select() to show only changed/deleted records          | | |
|  |  |  - Populates runtimeFObject on-the-fly                            | | |
|  |  |  - Handles applyOriginal to restore initial state                 | | |
|  |  +------------------------------------------------------------------+ | |
|  +----------------------------------------------------------------------+ |
|                                                                           |
+---------------------------------------------------------------------------+
```

---

## Key Concepts

### NDiff Data Model

| Property | Type | Description |
|----------|------|-------------|
| `cSpecName` | String | Name of the CSpec (service) this object belongs to |
| `objectId` | String | ID of the tracked object |
| `initialFObject` | FObjectProperty | Object as loaded from repo journal (`.0` file) |
| `runtimeFObject` | FObjectProperty | Current runtime state (transient, populated during select) |
| `deletedAtRuntime` | Boolean | True if object was deleted after initial load |
| `applyOriginal` | Boolean | Flag to trigger restoration of initial state |

### Composite ID

NDiff uses a composite ID: `(cSpecName, objectId)`. Each NDiff record tracks ONE object from ONE CSpec.

### Runtime Origin Flag

- `runtimeOrigin=false`: Data comes from repo journal (`.0` file) - recorded to NDiff
- `runtimeOrigin=true`: Data comes from runtime journal - not recorded (just passes through)

---

## How It Works

### Data Flow Diagram

```
+-------------------------------------------------------------------------+
|                          System Startup                                  |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| Step 1: Load Repo Journal (flows.0)                                      |
|                                                                          |
|   Journal Entry --> NDiffJournal(runtimeOrigin=false)                    |
|                           |                                              |
|                           v                                              |
|                     NDiffDAO.put_()                                      |
|                           |                                              |
|                           +--> Store object in target DAO                |
|                           |                                              |
|                           +--> Create NDiff record with initialFObject   |
|                                       |                                  |
|                                       v                                  |
|                                  ndiffDAO.put()                          |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| Step 2: Load Runtime Journal (flows.jrl)                                 |
|                                                                          |
|   Journal Entry --> NDiffJournal(runtimeOrigin=true)                     |
|                           |                                              |
|                           v                                              |
|                     NDiffDAO.put_()                                      |
|                           |                                              |
|                           +--> Store object in target DAO (NO NDiff)     |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| Step 3: User Queries NDiff (Admin Panel)                                 |
|                                                                          |
|   ndiffDAO.select() --> NDiffRuntimeDAO.select_()                        |
|                              |                                           |
|                              +--> Apply deltaPredicate filter:           |
|                              |    - Object deleted? (runtimeFObject=null)|
|                              |    - Object changed? (!equals check)      |
|                              |                                           |
|                              +--> Populate runtimeFObject from target DAO|
|                                          |                               |
|                                          v                               |
|                                   Return filtered results                |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| Step 4: User Actions                                                     |
|                                                                          |
|   "Compare Changes" --> Opens ComparisonView modal                       |
|                              |                                           |
|                              +--> Shows side-by-side:                    |
|                                   Before: initialFObject                 |
|                                   After:  runtimeFObject (or "Deleted")  |
|                                                                          |
|   "Apply Original"  --> Sets applyOriginal=true                          |
|                              |                                           |
|                              +--> NDiffRuntimeDAO.put_() detects flag    |
|                                          |                               |
|                                          +--> Restores initialFObject    |
|                                               to target DAO              |
+-------------------------------------------------------------------------+
```

### Filter Logic (What Gets Shown)

The `NDiffRuntimeDAO.select_()` only returns NDiff records where the object was either deleted at runtime OR the current runtime state differs from the initial state loaded from the repo journal.

---

## Usage

### Enabling NDiff

In your services.jrl, add `.setNdiff(true)` to the EasyDAO.Builder chain for any DAO you want to track.

### Accessing the NDiff Admin Panel

1. Navigate to Admin menu
2. Click on "NDiffs"
3. View table of changed/deleted objects

### Available Actions

- **Compare Changes**: Opens a modal showing side-by-side comparison of before/after states
- **Apply Original**: Restores the object to its initial state from the repo journal

---

## UI Components

### NDiff Table View

```
+------------------------------------------------------------------------+
| NDiffs                                                                  |
+--------------+--------------+----------------+------------+-------------+
| CSpec        | Object ID    | Deleted        | Actions    |             |
+--------------+--------------+----------------+------------+-------------+
| flowDAO      | flow-001     | false          | [Apply]    | [Compare]   |
| flowDAO      | flow-002     | true           | [Apply]    | [Compare]   |
| userDAO      | user-123     | false          | [Apply]    | [Compare]   |
+--------------+--------------+----------------+------------+-------------+
```

### ComparisonView Modal

```
+-------------------------------------------------------------------------+
| Comparison: flow-001                                                     |
+-------------------------------------------------------------------------+
|                                                                          |
|  +-------------------------------------------------------------------+  |
|  | Changed fields: [name] [status] [updatedAt]                        |  |
|  +-------------------------------------------------------------------+  |
|                                                                          |
|  +---------------------------+    +---------------------------+         |
|  | Before                    |    | After                     |         |
|  +---------------------------+    +---------------------------+         |
|  | id: flow-001              |    | id: flow-001              |         |
|  | name: "Original Name"     |    | name: "Updated Name"      |         |
|  | status: DRAFT             |    | status: ACTIVE            |         |
|  | createdAt: 2024-01-01     |    | createdAt: 2024-01-01     |         |
|  | updatedAt: 2024-01-01     |    | updatedAt: 2024-01-15     |         |
|  +---------------------------+    +---------------------------+         |
|                                                                          |
+-------------------------------------------------------------------------+
```

### Summary States

| State | Display | Color |
|-------|---------|-------|
| Deleted | "Object was deleted at runtime" | Red background |
| Changed | "Changed fields: [field1] [field2]..." | Yellow chips |
| Unchanged | "No changes detected" | Green background |

---

## Gotchas

1. **NDiff is opt-in**: Objects are NOT tracked by default. You must enable it per-DAO with `.setNdiff(true)`.

2. **Only repo journal changes are recorded**: Runtime journal entries pass through without creating NDiff records. This ensures you're comparing against the "source of truth" from version control.

3. **runtimeFObject is transient**: The `runtimeFObject` property is NOT persisted - it's fetched on-the-fly during `select()` operations. This ensures you always see the current state.

4. **Apply Original creates recursive calls**: When you apply the original, it puts to the target DAO which is decorated by NDiffDAO. The system handles this correctly by re-fetching the NDiff after the put.

5. **Filter limitations in UI**: Filtering and sorting in views may not work correctly because the predicate is applied before the sink can make changes. This is a known limitation.

6. **Composite ID required**: To find an NDiff record programmatically, you need both `cSpecName` and `objectId` using NDiffId.

7. **Works with JDAO only**: NDiff integrates at the JDAO level (journal-backed DAOs). It won't track changes to in-memory-only DAOs or direct database DAOs.
