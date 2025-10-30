# DateTimeUTC Property Type in FOAM3

## Overview

`DateTimeUTC` is a FOAM3 property type that handles date-time values with consistent UTC timezone treatment. It ensures all datetime values are stored, parsed, and displayed in UTC, eliminating timezone ambiguity across users and servers.

**Location**: `foam3/src/foam/lang/types.js:302-343`
**Extends**: `foam.lang.DateTime` (types.js:305)
**Java Type**: `java.util.Date` (defined in refinement at `foam3/src/foam/java/refinements.js:1518-1551`)
**Related Utilities**:
- `foam3/src/foam/util/DateUtil.js` - Main utility class with parsing and formatting methods
- `foam3/src/foam/parse/DateParser.js` - Grammar-based parser supporting multiple date/datetime formats

---

## What It Does

DateTimeUTC provides three core guarantees:

1. **UTC Storage** - All values stored as UTC timestamps internally
2. **UTC Parsing** - String inputs always interpreted as UTC (not local timezone) using `DateUtil.parseDateTimeUTC()`
3. **UTC Display** - Values always formatted in UTC timezone using `DateUtil.format(date, timeFirst, 'UTC')`

This eliminates timezone-related bugs where the same datetime appears differently to users in different timezones.

---

## Property Type Comparison

| Property Type | String Parsing | Time Component | Normalization | Use Case |
|--------------|----------------|----------------|---------------|----------|
| **Date** | Local timezone | Ignored (sets to noon) | Noon UTC | Birth dates, deadlines |
| **DateTime** | Native JS parser | Preserved as-is | None (local) | User-local events |
| **DateTimeUTC** | Forced UTC | Preserved in UTC | All UTC | Logs, transactions, API timestamps |

---

## Input Handling

DateTimeUTC uses `foam.util.DateUtil.parseDateTimeUTC()` which delegates to `foam.parse.DateParser.parseDateTimeUTC()`:

### 1. Number (Timestamp)
- **Behavior**: Preserved exactly
- **Example**: `1710511800000` → UTC timestamp maintained

### 2. Date Object
- **Behavior**: Preserved as-is
- **Example**: `new Date("2024-03-15T14:30:00Z")` → Unchanged

### 3. String with Time Component
- **Behavior**: Parsed and stored as **UTC time**
- **Example**: `"2024-03-15 14:30:00"` → `2024-03-15T14:30:00.000Z` (UTC)
- **Formats Supported**:
  - ISO 8601 with T: `2024-03-15T14:30:45.123`, `2024-03-15T14:30:45`, `2024-03-15T14:30`
  - ISO 8601 with space: `2024-03-15 14:30:45`, `2024-03-15 14:30`
  - ISO with slash: `2024/03/15T14:30:45`
  - US Format: `03/15/2024 14:30:45`, `03-15-2024 14:30`, `01/15/2025 14:30`
  - Compact: `20240315143045`

### 4. String with Date Only
- **Behavior**: Parsed and set to **midnight UTC** (00:00:00)
- **Example**: `"2024-03-15"` → `2024-03-15T00:00:00.000Z`
- **⚠️ Note**: Uses midnight UTC, not noon (differs from `Date` property which uses noon GMT)
- **Formats Supported**:
  - ISO: `2024-03-15`, `2024/03/15`, `20240315`
  - US: `03/15/2024`, `03-15-2024`, `03152024`
  - Short Year: `24-03-15`, `24/03/15`, `240315` (2-digit year with sliding window: 50 years back, 50 forward from current year)

### 5. String with Timezone Information
- **Behavior**: Timezone offset is parsed and converted to UTC
- **Example**: `"2024-03-15T14:30:00+05:30"` → `2024-03-15T09:00:00.000Z` (UTC)
- **Supported Formats**:
  - Z notation: `2024-03-15T14:30:45Z` (Zulu/UTC)
  - Offset with colon: `2024-03-15T14:30:45+05:30`, `2024-03-15T14:30:45-08:00`
  - Offset without colon: `2024-03-15T14:30:45+0530`, `2024-03-15T14:30:45-0800`
  - Hours only: `2024-03-15T14:30:45+05`, `2024-03-15T14:30:45-08`

---

## Output Formatting

DateTimeUTC always formats in UTC timezone via `foam.util.DateUtil.format(date, timeFirst, 'UTC')`:

- **Date only**: `"Mar 15, 2024"` (when `timeFirst` is `null` or `undefined`)
- **Date with time (time last)**: `"Mar 15, 2024 14:30:00"` (when `timeFirst` is `false`)
- **Time first**: `"14:30:00 Mar 15, 2024"` (when `timeFirst` is `true`)

Format uses:
- Short month names (Jan, Feb, Mar, etc.)
- 24-hour time format (HH:mm:ss)
- Consistent UTC timezone regardless of server/user location

---

## Current Limitations

### 1. Date-Only Inputs Set to Midnight UTC (Not Noon)
- `"2024-03-15"` → `2024-03-15T00:00:00Z` (midnight UTC)
- This differs from standard `Date` property behavior which sets to noon GMT
- **Impact**: Time will be 00:00:00 instead of 12:00:00 for date-only inputs
- **Rationale**: Midnight is the natural start of a date in UTC context

### 2. Timezone Information Not Preserved After Conversion
- Input with timezone: `"2024-03-15T14:30:00-05:00"`
- Correctly converts to UTC: `2024-03-15T19:30:00Z` ✅
- Original timezone `-05:00` is **lost forever** ❌
- No companion field exists to store original timezone
- **Workaround**: Store original timezone string in a separate String property if needed

### 3. Timezone Abbreviations Not Supported
- DateParser explicitly parses offset formats (Z, +HH:MM, etc.)
- Does NOT parse timezone abbreviations (EST, PST, IST, etc.)
- JavaScript's native Date parser is NOT used for timezone parsing
- **Example**: `"2024-03-15 14:30:00 EST"` would not parse correctly

---

## See Also

- **FOAM3 Property Types**: `foam3/src/foam/lang/types.js`
- **Date Utilities**: `foam3/src/foam/util/DateUtil.js`
- **Date Parser**: `foam3/src/foam/parse/DateParser.js`
- **DateUtil Tests**: `foam3/src/foam/util/test/DateUtilJSTest.js`, `foam3/src/foam/util/test/DateUtilTest.js`
- **DateParser Tests**: `foam3/src/foam/parse/test/DateParserTest.js`
- **Style Guide**: `foam3/doc/guides/StyleGuide.md`

