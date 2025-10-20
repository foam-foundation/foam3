# DateTimeUTC Property Type in FOAM3

## Overview

`DateTimeUTC` is a FOAM3 property type that handles date-time values with consistent UTC timezone treatment. It ensures all datetime values are stored, parsed, and displayed in UTC, eliminating timezone ambiguity across users and servers.

**Location**: `foam3/src/foam/lang/types.js:302-335`
**Related Utilities**: `foam3/src/foam/util/DateUtil.js`

---

## What It Does

DateTimeUTC provides three core guarantees:

1. **UTC Storage** - All values stored as UTC timestamps internally
2. **UTC Parsing** - String inputs always interpreted as UTC (not local timezone)
3. **UTC Display** - Values always formatted in UTC timezone

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

DateTimeUTC handles different input types through `foam.util.DateUtil.adaptDateTime(input, true)`:

### 1. Number (Timestamp)
- **Behavior**: Preserved exactly
- **Example**: `1710511800000` → UTC timestamp maintained

### 2. Date Object
- **Behavior**: Preserved as-is
- **Example**: `new Date("2024-03-15T14:30:00Z")` → Unchanged

### 3. String with Time Component
- **Behavior**: Parsed and stored as UTC
- **Example**: `"2024-03-15 14:30:00"` → `2024-03-15T14:30:00.000Z` (UTC)
- **Formats Supported**:
  - ISO 8601: `2024-03-15T14:30:45.123`, `2024-03-15T14:30:45`, `2024-03-15T14:30`
  - US Format: `03/15/2024 14:30:45`, `03/15/2024 14:30`
  - Compact: `20240315143045`

### 4. String with Date Only
- **Behavior**: Parsed and set to **midnight UTC** (00:00:00)
- **Example**: `"2024-03-15"` → `2024-03-15T00:00:00.000Z`
- **⚠️ Note**: Uses midnight, not noon (differs from `Date` property which uses noon)
- **Formats Supported**:
  - ISO: `2024-03-15`, `20240315`
  - US: `03/15/2024`, `03152024`
  - Short Year: `24-03-15`, `240315` (pivot: <50=2000s, ≥50=1900s)

---

## Output Formatting

DateTimeUTC always formats in UTC timezone via `foam.util.DateUtil.format(date, timeFirst, 'UTC')`:

- **Date only**: `"Mar 15, 2024"`
- **Date with time**: `"Mar 15, 2024 14:30:00"`
- **Time first**: `"14:30:00 Mar 15, 2024"`

---

## Current Limitations

### 1. Date-Only Inputs Set to Midnight (Not Noon)
- `"2024-03-15"` → `2024-03-15T00:00:00Z`
- This differs from standard `Date` property behavior which sets to noon
- **Impact**: Time will be 00:00:00 instead of 12:00:00 for date-only inputs

### 2. Timezone Information Not Preserved
- Input with timezone: `"2024-03-15T14:30:00-05:00"`
- Correctly converts to UTC: `2024-03-15T19:30:00Z` ✅
- Original timezone `-05:00` is **lost forever** ❌
- No companion field exists to store original timezone

### 3. Limited Timezone Format Support
- Relies on JavaScript's native Date parser for timezone strings
- Doesn't explicitly parse timezone abbreviations (EST, PST, etc.)
- Cannot extract timezone from all input formats

---

## See Also

- **FOAM3 Property Types**: `foam3/src/foam/lang/types.js`
- **Date Utilities**: `foam3/src/foam/util/DateUtil.js`
- **Style Guide**: `foam3/doc/guides/StyleGuide.md`

