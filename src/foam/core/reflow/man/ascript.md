<flow name="manual:AScript" category="MANUAL" keywords="help query,knowledge" accessLevel="PUBLIC_RO" spid="foam" description="AScript user guide: an Excel-like formula language for computing, formatting, and colouring fields in REFLOW."/>

# AScript User Guide

*Writing formulas in REFLOW*

---

## What is AScript?

AScript is a formula language for REFLOW. If you know Excel, you already know most of it — you write formulas the same way, using the same functions (`IF`, `ROUND`, `LEFT`, `SUM`, and so on) and the same arithmetic.

You use AScript to:

- **Compute a field's value** from other fields — for example, a *Total* column that adds up several amounts.
- **Format how a value is displayed** — as currency, to a fixed number of decimals, and so on.
- **Set a field's colour** — text colour and background, so important values stand out.
- **Transform data** — reshape a result before you work with it.

The important difference from a spreadsheet: an AScript formula runs **on the server, next to your data**. You don't wait for a large dataset to download before your formula can run, and the same formula works everywhere in REFLOW.

AScript builds on [AQL](manual:Query Syntax), the query language you already use to search and filter in REFLOW — so the tests you write inside `IF` and `IFS` follow those same familiar rules.

**Tip:** As you type a formula, the editor suggests function names and shows you what's available. You don't have to memorise anything — start typing and pick from the list.

---

## The basics

### Writing a formula

Just type the expression. Unlike Excel, you **do not** start with an `=` sign.

```
fee + tax + shipping
```

### Using field values

Refer to a field by its name. To reach a field inside a joined or nested record, use a dot:

```
amount
address.city
country_name
```

Field names come from your model. If you're not sure of a name, start typing and the editor will offer matches.

### Values you can type

| Kind | How to write it | Example |
|------|-----------------|---------|
| Number | just type it | `42`, `3.14`, `-5` |
| Text | inside double quotes | `"Settled"`, `"USD"` |
| Yes / no | `true` or `false` | `true` |

Text **must** be in double quotes. `"USD"` is the text USD; `USD` without quotes means *the field called USD*.

---

## Operators

### Arithmetic

| Operator | Meaning | Example | Result |
|----------|---------|---------|--------|
| `+` | add | `10 + 5` | `15` |
| `-` | subtract | `10 - 5` | `5` |
| `*` | multiply | `10 * 5` | `50` |
| `/` | divide | `10 / 4` | `2.5` |
| `^` | power | `2 ^ 3` | `8` |

For remainders, use the `MOD` function: `MOD(10, 3)` is `1`.

### Joining text

To join pieces of text together, use `+` (or the `CONCAT` function):

```
firstName + " " + lastName        →  "Kevin Greer"
"Ref: " + reference               →  "Ref: A00734"
CONCAT(country_code, "-", branch) →  "CA-004"
```

> ### ⚠️ Important: `&` is **not** "join" here
> In Excel, `&` joins text. **In AScript, `&` means AND** (a yes/no test), and `|` means OR.
> To join text, always use **`+`** or **`CONCAT`**.

### Writing conditions

A **condition** is a test that is either true or false — you'll use them inside `IF` and `IFS`. Conditions use REFLOW's query syntax (the same syntax you use to search and filter), so anything you can search for, you can test for. The most common forms:

| Condition | Meaning |
|-----------|---------|
| `amount = 100` | equal to |
| `amount != 100` | not equal to |
| `amount > 100`, `amount < 100` | greater / less than |
| `amount >= 100`, `amount <= 100` | greater / less than or equal |
| `name ~ "smith"` | contains (ignores capitalisation) |
| `status IN (A, B)` | matches any of the listed values |
| `notes IS EMPTY` | has no value |
| `active IS TRUE` | a yes/no field that is on |

Combine conditions with `AND` (`&`), `OR` (`|`), and `NOT`, and group with parentheses:

```
amount > 1000 & status = "P"
(status = "P" | status = "H") & amount > 0
```

**The full set of conditions** — ranges, dates, enum values, lists, empty checks, and more — is in the companion [Query Syntax](manual:Query Syntax). Everything there works inside an `IF` or `IFS` test.

### Order of operations

AScript follows the usual maths rules: powers first, then `*` and `/`, then `+` and `-`. Use parentheses `( )` to group and make your intent clear:

```
2 + 3 * 4       →  14
(2 + 3) * 4     →  20
```

---

## Making decisions

This is the part you'll use most. The **test** in an `IF` or `IFS` is a condition — see *[Writing conditions](#writing-conditions)* above, and the **[Query Syntax Guide](manual:Query Syntax)** for everything you can put there.

### IF — one test

`IF(test, value-if-true, value-if-false)`

```
IF(amount > 10000, "review", "auto")
IF(balance < 0, "OVERDRAWN", "OK")
```

### IFS — several tests in order

`IFS(test1, value1, test2, value2, …)` — returns the value for the **first** test that is true. End with `true` as a catch-all "otherwise":

```
IFS(
  balance > 1000, "high",
  balance > 500,  "medium",
  true,           "low"
)
```

### SWITCH — match one value against options

`SWITCH(value, option1, result1, option2, result2, …, otherwise)`

```
SWITCH(currency, "USD", "$", "EUR", "€", "GBP", "£", "?")
```

---

## Functions by category

Type a function name in the editor to see its arguments. Function names are not case-sensitive — `round`, `ROUND`, and `Round` all work.

### Text

| Function | What it does | Example → result |
|----------|--------------|------------------|
| `LEN(text)` | number of characters | `LEN("Kevin")` → `5` |
| `UPPER(text)` | make upper case | `UPPER("abc")` → `"ABC"` |
| `LOWER(text)` | make lower case | `LOWER("ABC")` → `"abc"` |
| `PROPER(text)` | Capitalise Each Word | `PROPER("kevin greer")` → `"Kevin Greer"` |
| `TRIM(text)` | remove extra spaces | `TRIM("  a   b ")` → `"a b"` |
| `LEFT(text, n)` | first n characters | `LEFT("Kevin", 3)` → `"Kev"` |
| `RIGHT(text, n)` | last n characters | `RIGHT("Kevin", 2)` → `"in"` |
| `MID(text, start, n)` | n characters from position `start` (starts at 1) | `MID("Kevin", 2, 3)` → `"evi"` |
| `SUBSTITUTE(text, old, new)` | replace text | `SUBSTITUTE("A-B-C", "-", "/")` → `"A/B/C"` |
| `FIND(find, in)` | position of text (or `-1`) | `FIND("v", "Kevin")` → `3` |
| `CONCAT(a, b, …)` | join text | `CONCAT("A", "B")` → `"AB"` |
| `LPAD(text, width)` | pad on the left (with `0`) | `LPAD("7", 4)` → `"0007"` |
| `RPAD(text, width)` | pad on the right | `RPAD("7", 4)` → `"7000"` |
| `LMASK(text, n)` | hide the first n characters | `LMASK("...3456", 12)` → `"************3456"` |

`LPAD`, `RPAD`, and `LMASK` take an optional last argument to choose the pad/mask character — e.g. `LMASK(card, 12, "#")`.

### Numbers

| Function | What it does | Example → result |
|----------|--------------|------------------|
| `ABS(n)` | positive value | `ABS(-5)` → `5` |
| `ROUND(n, places)` | round to decimals | `ROUND(12.345, 2)` → `12.35` |
| `ROUNDUP(n, places)` | always round up | `ROUNDUP(12.31, 1)` → `12.4` |
| `ROUNDDOWN(n, places)` | always round down | `ROUNDDOWN(12.39, 1)` → `12.3` |
| `INT(n)` | drop the decimals | `INT(12.9)` → `12` |
| `MIN(a, b, …)` | smallest | `MIN(balance, 0)` → `0` |
| `MAX(a, b, …)` | largest | `MAX(balance, 0)` → `balance` if positive |
| `SUM(a, b, …)` | add several | `SUM(fee, tax, shipping)` |
| `MOD(n, by)` | remainder | `MOD(10, 3)` → `1` |
| `FIX(n, places)` | number as fixed-decimal text | `FIX(12.5, 2)` → `"12.50"` |
| `CURRENCY(n)` | number as grouped text | `CURRENCY(1500)` → `"1,500"` |

### Dates

Two families of date functions — don't mix them up:

**Read a part of a date** (the calendar value):

| Function | Example → result |
|----------|------------------|
| `YEAR(date)` | `YEAR(opened)` → `2024` |
| `MONTH(date)` | `MONTH(opened)` → `3` |
| `DAY(date)` | `DAY(opened)` → `15` |
| `DATEDIF(from, to, "D")` | days between two dates |

**Measure elapsed time until now** (an age or duration):

| Function | Example → result |
|----------|------------------|
| `YEARS(date)` | `YEARS(born)` → `34` (age in years) |
| `MONTHS(date)` | months since the date |
| `DAYS(date)` | days since the date |
| `NOW` | the current date and time |

**Format a date as text** (for grouping and display — these return text, not a number):

| Function | Example → result |
|----------|------------------|
| `YYYYMMDD(date)` | `"2024/03/15"` — group by day |
| `YYYYMM(date)` | `"2024/03"` — group by month |
| `YYYYQQ(date)` | `"2024-Q1"` — group by quarter |
| `YYYYWWW(date)` | `"2024-W03"` — group by week (ISO) |
| `YYYYDDD(date)` | `"2024-075"` — day of the year |
| `HHMM(date)` | `"14:30"` — hour and minute |
| `HHMMSS(date)` | `"14:30:45"` — hour, minute, second |

> **Watch out — three ways to say "year":** `YEAR(born)` is a **number** (`2024`) for maths. `YEARS(born)` is an **age** (`34`), the years elapsed. `YYYYMM(opened)` and its family are **text** (`"2024/03"`) — use these to group rows into buckets (per month, quarter, week…), not to calculate with. Same idea for `HOUR` (number) vs `HHMM` (text).

### Checking a value

| Function | True when… |
|----------|-----------|
| `ISBLANK(x)` | the value is empty |
| `ISNUMBER(x)` | the value is a number |
| `ISTEXT(x)` | the value is text |

---

## Where you use AScript

When you create or edit a field in a **custom model**, you'll see four boxes that each take an AScript formula. They travel with the field, so you don't have to re-apply them every time.

| Box | What it controls | Example |
|-----|------------------|---------|
| **Formula** | the field's value | `fee + tax + shipping` |
| **Formatter** | how the value is *displayed* | `CURRENCY(total)` |
| **Color** | text colour | `IF(balance < 0, "red", "black")` |
| **Background** | background colour | `IF(flagged, "yellow", "white")` |

**The Formatter only changes how a value looks, not the value itself.** A total formatted as `"$1,500.00"` is still the number `1500` underneath — so you can still search, sort, and filter on it normally.

### Joined fields

A custom model can pull in fields from another model (a **join**). Those fields show up with a prefix and are ready to use in your formulas, just like your own fields:

```
country_name
country_iso
```

You don't need to do anything special — once the join is set up, joined fields appear in the editor's suggestions.

---

## Examples

**Build a display name**
```
firstName + " " + lastName
```

**Pad a cycle number to four digits**
```
LPAD(cycle, 4)                     →  "0007"
```

**Mask a card number, showing the last four**
```
LMASK(cardNumber, 12)              →  "************3456"
```

**Round a fee to cents**
```
ROUND(feeAmount, 2)
```

**Route a transaction by size**
```
IF(amount > 10000, "review", "auto")
```

**Turn a status code into words**
```
IFS(status = "S", "Settled",
    status = "P", "Pending",
    true,         "Unknown")
```

**Floor a balance at zero for display**
```
MAX(balance, 0)
```

**Days since an account opened**
```
DATEDIF(openedDate, NOW, "D")
```

**Colour negative balances red**  *(in the Color box)*
```
IF(balance < 0, "red", "black")
```

---

## Common mistakes

- **Using `&` to join text.** `&` means AND here. Use `+` or `CONCAT` to join text.
- **Forgetting quotes around text.** `"Pending"` is text; `Pending` (no quotes) is treated as a field name and won't be found.
- **Starting with `=`.** You don't need it — just type the formula.
- **Mixing up `YEAR` and `YEARS`.** `YEAR` reads the calendar year; `YEARS` measures age/elapsed years.
- **Capitalisation in text tests.** `status = "p"` is exact and case-sensitive. To match while ignoring capitalisation, use `~` ("contains"): `status ~ "p"`.
- **Counting characters from 0.** `MID` and `FIND` count from **1**, like Excel.

---

## Quick reference

**Operators**

```
+  -  *  /  ^         maths          ( MOD(a,b) for remainder )
+                     join text      ( or CONCAT(...) )
( )                   grouping

Conditions (the test inside IF / IFS) — REFLOW query syntax:
=  !=  <  >  <=  >=   compare         ~ contains    IN (…)    IS EMPTY    IS TRUE
&  AND       |  OR       NOT(...)
                      full set → Query Syntax Guide
```

**Most-used functions**

```
Decisions:  IF( test, a, b )   IFS( t1, v1, t2, v2, … )   SWITCH( x, o1, r1, …, else )
Text:       LEN  LEFT  RIGHT  MID  UPPER  LOWER  TRIM  PROPER  CONCAT  SUBSTITUTE  LPAD  LMASK
Numbers:    ROUND  ROUNDUP  ROUNDDOWN  INT  ABS  MIN  MAX  SUM  MOD  FIX  CURRENCY
Dates:      YEAR  MONTH  DAY  DATEDIF        
            (elapsed: YEARS  MONTHS  DAYS  NOW)
            (to text: YYYYMM  YYYYMMDD  YYYYQQ  YYYYWWW  YYYYDDD  HHMM  HHMMSS)
```

---

*When in doubt, start typing in the formula editor — it will suggest what fits.*