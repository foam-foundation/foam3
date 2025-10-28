# Wrapped Flow Import

## The Problem

When using `includeFlow(name)`, all blocks from the imported flow are added directly to your current flow:

```javascript
includeFlow('Console')

// Your flow structure becomes:
// YourFlow
//   ├─ block1 (from Console)
//   ├─ block2 (from Console)
//   ├─ block3 (from Console)
//   ├─ your test block 1
//   └─ your test block 2
```

**Issues:**
- When you rerun the script, imported blocks get mixed with your test blocks
- You lose your test structure when reimporting
- Can't easily delete just the imported content

## The Solution

Use the `includeFlowWrapped` command to wrap the imported flow in a container block:

```javascript
includeFlowWrapped('Console', 'console_wrapper')

// Your flow structure becomes:
// YourFlow
//   ├─ console_wrapper (container - easily deletable)
//   │   ├─ block1 (from Console)
//   │   ├─ block2 (from Console)
//   │   └─ block3 (from Console)
//   ├─ your test block 1
//   └─ your test block 2
```

**Benefits:**
- All imported content stays in one container block
- Delete the wrapper to remove all imported content
- Reimport without affecting your test structure
- **Automatic refresh on rerun** - just rerun your flow and the imported content updates automatically!

## Usage

```javascript
// Import wrapped - creates a block named 'console_wrapper'
includeFlowWrapped('Console', 'console_wrapper')

// Or use default wrapper name (adds '_wrapper' suffix)
includeFlowWrapped('Console')  // Creates 'Console_wrapper'

// To refresh, simply rerun your test flow
// The command will automatically:
// 1. Remove the old wrapper and its children
// 2. Reload the latest version of the imported flow
// 3. Recreate the wrapper with fresh content
```

## How Auto-Update Works

When you rerun your flow, the `includeFlowWrapped` command:
1. Checks if a wrapper with the same name already exists
2. If found, removes the old wrapper and all its children
3. Clears any existing content from the current block
4. Loads the latest version of the flow's script as children
5. All your test blocks remain untouched

**Example workflow:**
```javascript
// 1. Create test flow with wrapped import
includeFlowWrapped('Console', 'console_wrapper')
// ... your test blocks ...

// 2. Make changes to the Console flow

// 3. Rerun your test flow - wrapper automatically updates!
// No manual deletion needed, no lost test structure
```
