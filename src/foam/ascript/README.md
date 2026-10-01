# AScript - Auto-Completeable Excel-Compatible Expression Language

## Overview

**AScript** is an Excel-compatible expression language embedded in FOAM, enabling developers and business users to write spreadsheet-like formulas that execute both on the client (JavaScript) and server (Java) sides. It bridges the gap between Excel's familiar syntax and FOAM's cross-platform architecture.

### Key Characteristics

- **Excel-Compatible Syntax** – Uses standard Excel function names (UPPER, LOWER, MID, ROUND, etc.)
- **Cross-Platform** – Single expression evaluates identically in JavaScript and Java
- **Scalar-Focused** – Designed for per-record field calculations, not bulk range operations
- **Extensible** – New functions can be added via `ALANG` (AScript Language) definitions
- **Zero External Dependencies** – Core library (`foam.ascript.Lib`) is standalone

## Architecture

### Three-Layer Stack

```
┌──────────────────────────────────────────┐
│  AScript Parser & Expressions            │
│  (accepts "UPPER(name)", "ROUND(x, 2)")  │
└──────────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────────┐
│  ALANG Function Definitions              │
│  (maps function name to code/javaCode)   │
└──────────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────────┐
│  foam.ascript.Lib (JS & Java)            │
│  (canonical implementations)             │
└──────────────────────────────────────────┘
```

### Components

#### 1. **foam.ascript.Lib** (JavaScript)
Core library of scalar functions: 80+ implemented in pure JavaScript, requiring no FOAM mlang or FObject awareness. Can be loaded standalone.

**Location:** `foam/ascript/lib.js`

#### 2. **Lib.java** (Java)
Server-side mirror of the JavaScript library: identical function signatures and behavior, implementing the same formulas in Java for runtime evaluation.

**Location:** `foam/ascript/Lib.java`

#### 3. **ALANG Definitions** (`foam.ALANG([...])`)
Declarative function wrappers that:
- Define argument specs (type, name, defaults)
- Supply inline JavaScript execution code
- Supply inline Java execution code via `javaCode`
- Provide documentation visible in IDE autocomplete and help

**Location:** `foam/ascript/alang.js`

## Function Categories

### Text Functions (24)
Manipulate and analyze strings.

| Function | Purpose |
|----------|---------|
| `LEN(text)` | String length |
| `UPPER(text)` | Convert to uppercase |
| `LOWER(text)` | Convert to lowercase |
| `PROPER(text)` | Capitalize each word |
| `TRIM(text)` | Remove leading/trailing/extra spaces |
| `LEFT(text, n)` | Leftmost n characters |
| `RIGHT(text, n)` | Rightmost n characters |
| `MID(text, start, len)` | 1-based substring |
| `SUBSTITUTE(text, old, new)` | Replace text |
| `FIND(find, within)` | Case-sensitive search (1-based) |
| `SEARCH(find, within)` | Case-insensitive search |
| `CONCATENATE(a, b, ...)` | Join strings |
| `CHAR(code)`, `CODE(text)` | Character/code conversion |
| `LPAD(str, len)`, `RPAD(str, len)` | Pad left/right |
| `LMASK(str, len)`, `RMASK(str, len)` | Mask left/right characters |

### Math Functions (26)
Numeric calculations.

| Function | Purpose |
|----------|---------|
| `ROUND(num, digits)` | Round to decimal places |
| `ROUNDUP(num, digits)` | Round away from zero |
| `ROUNDDOWN(num, digits)` | Round toward zero |
| `INT(num)` | Round down to integer |
| `TRUNC(num, digits)` | Truncate toward zero |
| `ABS(num)` | Absolute value |
| `SQRT(num)` | Square root |
| `POWER(a, b)` | a to the power b |
| `MOD(a, b)` | Remainder after division |
| `SIGN(num)` | Sign (-1, 0, 1) |
| `CEILING(num, significance)` | Round up to multiple |
| `FLOOR(num, significance)` | Round down to multiple |
| `EVEN(num)`, `ODD(num)` | Round to nearest even/odd |
| `DIFF(a, b)` | Absolute difference |
| `MROUND(num, multiple)` | Round to nearest multiple |
| `FIX(num, precision)` | Format with decimals |
| `CURRENCY(amt, precision)` | Format with grouping |

### Advanced Math (8)
Logarithms, combinatorics, base conversions.

| Function | Purpose |
|----------|---------|
| `LOG(num, base)` | Logarithm (default base 10) |
| `FACT(n)` | Factorial |
| `COMBIN(n, k)` | Combinations |
| `PERMUT(n, k)` | Permutations |
| `GCD(a, b)`, `LCM(a, b)` | Greatest common divisor / Least common multiple |
| `DEGREES(rad)`, `RADIANS(deg)` | Angle conversion |

### Date/Time Functions (11)
Extract and manipulate dates.

| Function | Purpose |
|----------|---------|
| `YEAR(date)`, `MONTH(date)`, `DAY(date)` | Extract year, month, day |
| `HOUR(date)`, `MINUTE(date)`, `SECOND(date)` | Extract time components |
| `WEEKDAY(date)` | Day of week (1=Mon, 7=Sun) |
| `DATE(year, month, day)` | Construct date |
| `EDATE(date, months)` | Date ±months |
| `EOMONTH(date, months)` | Last day of month ±months |
| `DATEDIF(start, end, "Y"|"M"|"D")` | Difference in units |

### Type Checking (7)
Identify value types.

| Function | Purpose |
|----------|---------|
| `ISNUMBER(value)` | Is numeric? |
| `ISTEXT(value)` | Is string? |
| `ISBLANK(value)` | Is null/empty? |
| `ISLOGICAL(value)` | Is boolean? |
| `ISEVEN(num)`, `ISODD(num)` | Is even/odd? |
| `N(value)` | Coerce to number |

### Base Conversions (10)
Convert between number bases.

| Function | Purpose |
|----------|---------|
| `ROMAN(n)` | Integer to Roman numerals |
| `ARABIC(text)` | Roman numerals to integer |
| `BASE(n, radix, minLen)` | Integer to text (any base) |
| `DECIMAL(text, radix)` | Text (any base) to integer |
| `BIN2DEC`, `DEC2BIN` | Binary ↔ decimal |
| `HEX2DEC`, `DEC2HEX` | Hexadecimal ↔ decimal |
| `OCT2DEC`, `DEC2OCT` | Octal ↔ decimal |

## Usage

### In FOAM Classes (mlang)

```javascript
foam.CLASS({
  name: 'InvoiceItem',
  properties: [
    { class: 'Float', name: 'grossAmount' },
    { class: 'Float', name: 'taxRate' },
    { class: 'Float', name: 'taxAmount',
      expression: function(taxRate, grossAmount) {
        return taxRate * grossAmount;
      }
    },
    { class: 'String', name: 'itemCode' },
    { class: 'String', name: 'maskedCode',
      expression: function(itemCode) {
        // AScript function called from expression
        return foam.ascript.Lib.LMASK(itemCode, 3);
      }
    }
  ]
});
```

### In AScript Formulas

```javascript
// Client-side formula evaluation
var expr = foam.lookup('foam.ascript.Parser').parse('UPPER(TRIM(name))');
var value = expr.f({ name: '  hello  ' }); // "HELLO"

// Server-side (Java)
// Same formula evaluates identically on backend
```

### Inline JavaScript

```javascript
foam.ascript.Lib.ROUND(3.14159, 2);       // → 3.14
foam.ascript.Lib.UPPER("hello");           // → "HELLO"
foam.ascript.Lib.FIND("world", "hello"); // → -1
foam.ascript.Lib.SUBSTITUTE("cat", "a", "o"); // → "cot"
```

## Philosophy

### Scalar-Only by Design

AScript intentionally excludes:
- **Range functions** (SUM over columns, AVERAGE, COUNTIF)
- **Lookup functions** (VLOOKUP, INDEX/MATCH, array formulas)
- **Aggregations** (GROUP BY, HAVING)

**Why?** These operations require dataset context and are the job of the query layer (GroupBy, REFLOW DAO queries, SQL). Mixing them into a scalar expression language would duplicate logic and cause confusion about where computation happens.

**Result:** Simpler, more focused library; clearer architecture; better performance.

### Cross-Platform Parity

Every function has:
1. A **JavaScript implementation** in `foam.ascript.Lib`
2. A **Java implementation** in `Lib.java`
3. An **ALANG wrapper** with documentation and argument specs

This ensures that a formula written by a business user works identically whether evaluated client-side (fast, responsive) or server-side (secure, authoritative).

### Extensibility via ALANG

To add a custom function:

```javascript
foam.ALANG([
  {
    name: 'MY_FUNC',
    documentation: 'Do something custom.',
    args: [
      { class: 'String', name: 'input' },
      { class: 'Int', name: 'param', value: 10 }
    ],
    code: function(input, param) {
      return foam.ascript.Lib.MY_FUNC(input, param);
    },
    javaCode: 'return foam.ascript.Lib.MY_FUNC(input, param);'
  }
]);

// Implement in foam.ascript.Lib (JS) and Lib.java
```

## Common Use Cases

### 1. Data Normalization
```javascript
UPPER(TRIM(SUBSTITUTE(email, " ", "")))
```

### 2. Masking Sensitive Fields
```javascript
RMASK(creditCard, 4) // Mask last 4 digits
```

### 3. Time-Based Calculations
```javascript
DATEDIF(birthDate, TODAY(), "Y") // Age in years
```

### 4. Formatting for Display
```javascript
CONCATENATE("Qty: ", quantity, " @ ", CURRENCY(unitPrice, 2))
```

### 5. Conditional Transformations
```javascript
IF(status = "ACTIVE", UPPER(name), LOWER(name))
```

### 6. Number Base Conversions
```javascript
HEX2DEC(colorCode) // Convert #FF00AA → numeric value
```

## Performance Notes

- **Client-side:** Direct function calls are ~1µs per function (after FOAM init)
- **Server-side:** Java implementations typically faster than JavaScript equivalents
- **Parser overhead:** AScript parsing is lazy; formulas are compiled on first use
- **No dependencies:** `foam.ascript.Lib` can be loaded as a standalone utility library

## Contributing

To add a new function:

1. **Implement in `foam.ascript.Lib` (JavaScript)**
2. **Implement in `Lib.java`** with identical behavior
3. **Add ALANG wrapper** with documentation
4. **Write unit tests** for both platforms
5. **Verify Excel compatibility** for standard functions

Naming convention: Use UPPER_CASE for function names (Excel style).
