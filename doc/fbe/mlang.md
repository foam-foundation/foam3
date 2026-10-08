<flow name="be:mlang" category="DOC/EXAMPLES" spid="foam" description="Live examples of MLang, FOAM's cross-platform query and expression language that runs in JavaScript, Java and SQL." keywords="mlang,query,predicate,expression,sql,fbe,example,knowledge"/>

<tocconfig index></tocconfig>

# FOAM MLang By Example

<term term="MLang"></term> (Model Language) is FOAM's cross-platform query and expression language. MLangs compile to the same AST in JavaScript, Java, and SQL, enabling queries written once to execute anywhere.

<toc></toc>

## Overview

MLangs serve multiple purposes:

| Category | Purpose | Examples |
|----------|---------|----------|
| **Predicates** | Filter data (WHERE clauses) | EQ, GT, AND, OR, CONTAINS |
| **Comparators** | Sort data (ORDER BY) | DESC, THEN_BY, compound sorts |
| **Expressions** | Compute values | ADD, MUL, DOT, property access |
| **Sinks** | Aggregate results | COUNT, SUM, GROUP_BY, MAP |

### Why MLang?

- **Cross-platform** — Same query works in JS, Java, and SQL
- **Type-safe** — Properties are referenced by constants, not strings
- **Composable** — Build complex queries from simple parts
- **Optimizable** — Queries can be analyzed and optimized

---

## Setup

Create a singleton for convenient access to MLang expressions.

<example id="setup">
// Most MLang expressions are on foam.mlang.Expressions
var M = foam.mlang.ExpressionsSingleton.create();

// Sample data model
foam.CLASS({
  name: 'Person',
  properties: [
    { class: 'String', name: 'id' },
    { class: 'String', name: 'name' },
    { class: 'Int', name: 'age' },
    { class: 'Float', name: 'salary' }
  ]
});

// Sample DAO with test data
var dao = foam.dao.EasyDAO.create({
  of: Person,
  seqNo: true,
  daoType: 'MDAO',
  testData: [
    { name: 'John', age: 21, salary: 100 },
    { name: 'Dave', age: 18, salary: 50 },
    { name: 'Steve', age: 18, salary: 75 },
    { name: 'Andy', age: 28, salary: 125 },
    { name: 'Dave', age: 23, salary: 80 }
  ]
});
</example>

---

## Predicates

<term term="Predicates"></term> are boolean expressions used to filter data. They implement `f(obj)` returning true/false.

### Quick Reference

| Predicate | Description | Example |
|-----------|-------------|---------|
| `TRUE` / `FALSE` | Constants | `M.TRUE` |
| `EQ(a, b)` | Equals | `M.EQ(Person.NAME, 'John')` |
| `NEQ(a, b)` | Not equals | `M.NEQ(Person.AGE, 18)` |
| `LT(a, b)` | Less than | `M.LT(Person.AGE, 21)` |
| `LTE(a, b)` | Less than or equal | `M.LTE(Person.AGE, 21)` |
| `GT(a, b)` | Greater than | `M.GT(Person.SALARY, 100)` |
| `GTE(a, b)` | Greater than or equal | `M.GTE(Person.AGE, 18)` |
| `AND(a, b, ...)` | Logical AND | `M.AND(p1, p2, p3)` |
| `OR(a, b, ...)` | Logical OR | `M.OR(p1, p2)` |
| `NOT(a)` | Logical NOT | `M.NOT(predicate)` |
| `IN(prop, array)` | Value in array | `M.IN(Person.NAME, ['John', 'Dave'])` |
| `CONTAINS(prop, str)` | String contains | `M.CONTAINS(Person.NAME, 'oh')` |
| `CONTAINS_IC(prop, str)` | Contains (case-insensitive) | `M.CONTAINS_IC(Person.NAME, 'OH')` |
| `STARTS_WITH(prop, str)` | String starts with | `M.STARTS_WITH(Person.NAME, 'J')` |
| `STARTS_WITH_IC` | Starts with (case-insensitive) | `M.STARTS_WITH_IC(Person.NAME, 'j')` |
| `HAS(prop)` | Property has value | `M.HAS(Person.NAME)` |
| `INSTANCE_OF(class)` | Type check | `M.INSTANCE_OF(Person)` |
| `KEYWORD(str)` | Full-text search | `M.KEYWORD('john')` |

---

## Basic Predicates

### TRUE and FALSE

Constant predicates useful as defaults or in generated queries.

<example id="true-false">
log('TRUE:  ', M.TRUE.f());
log('FALSE: ', M.FALSE.f());
</example>

### EQ (Equals)

The most common predicate — tests equality between a property and a value.

<example id="eq">
// Property shortcut for EQ
dao.where(Person.NAME.eq('John')).select().then(log);

// Using M.EQ explicitly
dao.where(M.EQ(Person.NAME, 'John')).select().then(log);

// EQ can also compare two properties
dao.where(M.EQ(Person.NAME, Person.ID)).select().then(log);
</example>

### NEQ (Not Equals)

<example id="neq">
dao.where(M.NEQ(Person.NAME, 'John')).select().then(log);
</example>

### LT, LTE, GT, GTE (Comparisons)

<example id="comparisons">
// Less than
dao.where(M.LT(Person.AGE, 21)).select().then(log);

// Less than or equal
dao.where(M.LTE(Person.AGE, 21)).select().then(log);

// Greater than
dao.where(M.GT(Person.AGE, 21)).select().then(log);

// Greater than or equal
dao.where(M.GTE(Person.AGE, 21)).select().then(log);
</example>

---

## Logical Operators

### AND

Combines predicates — all must be true.

<example id="and">
// All conditions must match
dao.where(M.AND(
  M.EQ(Person.NAME, 'Dave'),
  M.GT(Person.AGE, 20)
)).select().then(log);

// Multiple arguments supported
dao.where(M.AND(
  M.GTE(Person.AGE, 18),
  M.LTE(Person.AGE, 25),
  M.GT(Person.SALARY, 50)
)).select().then(log);
</example>

### OR

Combines predicates — any can be true.

<example id="or">
dao.where(M.OR(
  M.EQ(Person.NAME, 'John'),
  M.EQ(Person.NAME, 'Dave')
)).select().then(log);
</example>

### NOT

Negates a predicate.

<example id="not">
dao.where(M.NOT(M.EQ(Person.NAME, 'John'))).select().then(log);

// Equivalent to NEQ
dao.where(M.NEQ(Person.NAME, 'John')).select().then(log);
</example>

---

## String Predicates

### HAS

Tests if a property has a non-empty value.

<example id="has">
var p = M.HAS(Person.NAME);
log('HAS name "John":', p.f(Person.create({ name: 'John' })));
log('HAS name "":', p.f(Person.create({ name: '' })));
log('HAS no name:', p.f(Person.create()));
</example>

### CONTAINS and CONTAINS_IC

Tests if a string property contains a substring.

<example id="contains">
// Case-sensitive
dao.where(M.CONTAINS(Person.NAME, 'oh')).select().then(log);

// Case-insensitive
dao.where(M.CONTAINS_IC(Person.NAME, 'OH')).select().then(log);
</example>

### STARTS_WITH and STARTS_WITH_IC

Tests if a string property starts with a prefix.

<example id="starts-with">
// Case-sensitive
dao.where(M.STARTS_WITH(Person.NAME, 'D')).select().then(log);

// Case-insensitive
dao.where(M.STARTS_WITH_IC(Person.NAME, 'd')).select().then(log);
</example>

### ENDS_WITH and ENDS_WITH_IC

Tests if a string property ends with a suffix.

<example id="ends-with">
// Case-sensitive
dao.where(M.ENDS_WITH(Person.NAME, 'e')).select().then(log);

// Case-insensitive
dao.where(M.ENDS_WITH_IC(Person.NAME, 'E')).select().then(log);
</example>

### REG_EXP

Tests against a regular expression.

<example id="regexp">
// Names containing 'a' or 'e'
dao.where(M.REG_EXP(Person.NAME, /[ae]/i)).select().then(log);
</example>

---

## Collection Predicates

### IN

Tests if a value is in an array.

<example id="in">
dao.where(M.IN(Person.NAME, ['John', 'Steve'])).select().then(log);
</example>

### INSTANCE_OF

Tests if an object is an instance of a class.

<example id="instance-of">
var p = M.INSTANCE_OF(Person);
log('Person instance:', p.f(Person.create({ name: 'test' })));
log('Plain object:', p.f({ name: 'test' }));
</example>

---

## Full-Text Search

### KEYWORD

Searches across all searchable properties of a model.

<example id="keyword">
// Searches name and other string properties
dao.where(M.KEYWORD('john')).select().then(log);

// Partial match
dao.where(M.KEYWORD('dav')).select().then(log);
</example>

---

## Comparators

<term term="Comparators"></term> define sort order for `orderBy()`. They implement `compare(a, b)` returning negative, zero, or positive.

### Quick Reference

| Comparator | Description |
|------------|-------------|
| `property` | Ascending by property |
| `DESC(property)` | Descending by property |
| `THEN_BY(c1, c2)` | Compound sort |

### DESC (Descending)

<example id="desc">
// Ascending (default)
dao.orderBy(Person.AGE).select().then(log);

// Descending
dao.orderBy(M.DESC(Person.AGE)).select().then(log);
</example>

### THEN_BY (Compound Sort)

Sort by multiple criteria — when the first comparator returns equal, use the second.

<example id="then-by">
// Sort by age, then by name
dao.orderBy(M.THEN_BY(Person.AGE, Person.NAME)).select().then(log);

// Sort by age descending, then by salary ascending
dao.orderBy(M.THEN_BY(
  M.DESC(Person.AGE),
  Person.SALARY
)).select().then(log);
</example>

### Compound orderBy Shortcut

Multiple arguments to `orderBy()` are automatically combined with THEN_BY.

<example id="orderby-shortcut">
// Equivalent to THEN_BY
dao.orderBy(Person.AGE, Person.NAME).select().then(log);

// With DESC
dao.orderBy(M.DESC(Person.AGE), Person.NAME).select().then(log);
</example>

---

## Expressions

<term term="Expressions"></term> compute values from objects. Used in predicates, comparators, and projections.

### Property Access

Properties are expressions that extract their value from an object.

<example id="property-expr">
var john = Person.create({ name: 'John', age: 25 });

// Property.f(obj) extracts the value
log('Name:', Person.NAME.f(john));
log('Age:', Person.AGE.f(john));
</example>

### Arithmetic Expressions

| Expression | Description |
|------------|-------------|
| `ADD(a, b)` | Addition |
| `SUB(a, b)` | Subtraction |
| `MUL(a, b)` | Multiplication |
| `DIV(a, b)` | Division |
| `MOD(a, b)` | Modulo |
| `MAX(a, b)` | Maximum |
| `MIN(a, b)` | Minimum |
| `NEG(a)` | Negation |

<example id="arithmetic">
var john = Person.create({ name: 'John', age: 25, salary: 100 });

// Compute expressions
log('Age + 10:', M.ADD(Person.AGE, 10).f(john));
log('Salary * 2:', M.MUL(Person.SALARY, 2).f(john));
log('Age / 5:', M.DIV(Person.AGE, 5).f(john));

// Use in predicates
dao.where(M.GT(M.MUL(Person.AGE, 2), 40)).select().then(log);
</example>

### DOT (Nested Property Access)

Access properties of nested objects.

<example id="dot">
foam.CLASS({
  name: 'Company',
  properties: ['name', 'ceo']
});

var company = Company.create({
  name: 'Acme',
  ceo: Person.create({ name: 'John', age: 45 })
});

// Access nested property
var ceoAge = M.DOT(Company.CEO, Person.AGE);
log('CEO Age:', ceoAge.f(company));
</example>

---

## Sinks

<term term="Sinks"></term> process and aggregate results from `select()`. They implement `put(obj)` for each result.

### Quick Reference

| Sink | Description | Result Property |
|------|-------------|-----------------|
| `ArraySink` | Collect to array | `.array` |
| `COUNT()` | Count results | `.value` |
| `SUM(expr)` | Sum values | `.value` |
| `AVG(expr)` | Average values | `.value` |
| `MIN(expr)` | Minimum value | `.value` |
| `MAX(expr)` | Maximum value | `.value` |
| `GROUP_BY(expr, sink)` | Group by expression | `.groups` |
| `MAP(expr, sink)` | Transform values | delegates to sink |
| `UNIQUE(expr, sink)` | Deduplicate | delegates to sink |
| `SEQ(sink1, sink2)` | Multiple sinks | results in each |

---

## Aggregation Sinks

### COUNT

<example id="count">
dao.select(M.COUNT()).then(function(count) {
  log('Total count:', count.value);
});

// Count with filter
dao.where(M.GT(Person.AGE, 20)).select(M.COUNT()).then(function(count) {
  log('Count age > 20:', count.value);
});
</example>

### SUM

<example id="sum">
dao.select(M.SUM(Person.SALARY)).then(function(sum) {
  log('Total salary:', sum.value);
});

// Sum with filter
dao.where(M.GT(Person.AGE, 20)).select(M.SUM(Person.SALARY)).then(function(sum) {
  log('Salary where age > 20:', sum.value);
});
</example>

### AVG (Average)

<example id="avg">
dao.select(M.AVG(Person.AGE)).then(function(avg) {
  log('Average age:', avg.value);
});
</example>

### MIN and MAX

<example id="min-max">
dao.select(M.MIN(Person.AGE)).then(function(min) {
  log('Minimum age:', min.value);
});

dao.select(M.MAX(Person.SALARY)).then(function(max) {
  log('Maximum salary:', max.value);
});
</example>

---

## Grouping and Transformation

### GROUP_BY

Groups results by an expression, applying a sink to each group.

<example id="group-by">
// Group by age, count each group
dao.select(M.GROUP_BY(Person.AGE, M.COUNT())).then(function(groups) {
  log('Groups:', groups.groupKeys);
  for (var age of groups.groupKeys) {
    log('Age', age, ':', groups.groups[age].value, 'people');
  }
});

// Group by age, collect names
dao.select(M.GROUP_BY(Person.AGE, M.MAP(Person.NAME, foam.dao.ArraySink.create()))).then(function(groups) {
  for (var age of groups.groupKeys) {
    log('Age', age, ':', groups.groups[age].array.join(', '));
  }
});
</example>

### MAP

Transforms each value through an expression before passing to another sink.

<example id="map">
// Extract just the names
dao.select(M.MAP(Person.NAME, foam.dao.ArraySink.create())).then(function(sink) {
  log('Names:', sink.array);
});

// Compute derived values
dao.select(M.MAP(M.MUL(Person.SALARY, 12), foam.dao.ArraySink.create())).then(function(sink) {
  log('Annual salaries:', sink.array);
});
</example>

### UNIQUE

Deduplicates values based on an expression.

<example id="unique">
// Get unique ages
dao.select(M.UNIQUE(Person.AGE, foam.dao.ArraySink.create())).then(function(sink) {
  log('Unique ages:', sink.array);
});

// Get unique names
dao.select(M.UNIQUE(Person.NAME, foam.dao.ArraySink.create())).then(function(sink) {
  log('Unique names:', sink.array);
});
</example>

### SEQ (Sequence)

Passes each result to multiple sinks.

<example id="seq">
var count = M.COUNT();
var sum = M.SUM(Person.SALARY);

dao.select(M.SEQ(count, sum)).then(function() {
  log('Count:', count.value);
  log('Sum:', sum.value);
});
</example>

---

## Advanced Patterns

### Computed Predicates

Combine expressions and predicates for complex conditions.

<example id="computed-predicates">
// Age times 2 is greater than 40
dao.where(M.GT(M.MUL(Person.AGE, 2), 40)).select().then(log);

// Salary is more than age * 5
dao.where(M.GT(Person.SALARY, M.MUL(Person.AGE, 5))).select().then(log);
</example>

### Dynamic Queries

Build queries programmatically.

<example id="dynamic-queries">
function buildQuery(filters) {
  var predicates = [];

  if (filters.name) {
    predicates.push(M.CONTAINS_IC(Person.NAME, filters.name));
  }
  if (filters.minAge) {
    predicates.push(M.GTE(Person.AGE, filters.minAge));
  }
  if (filters.maxSalary) {
    predicates.push(M.LTE(Person.SALARY, filters.maxSalary));
  }

  return predicates.length ? M.AND(...predicates) : M.TRUE;
}

// Use the dynamic query
var query = buildQuery({ minAge: 20, maxSalary: 100 });
dao.where(query).select().then(log);
</example>

### Subqueries with MAP

Use MAP to extract IDs for subqueries (manual joins).

<example id="subquery">
// Get IDs of adults
var adultIds = foam.dao.ArraySink.create();

dao.where(M.GTE(Person.AGE, 21))
   .select(M.MAP(Person.ID, adultIds))
   .then(function() {
     log('Adult IDs:', adultIds.array);

     // Use in another query
     return dao.where(M.IN(Person.ID, adultIds.array)).select();
   })
   .then(log);
</example>

---

## MLang SQL Translation

MLangs translate to SQL when used with SQL-backed DAOs:

| MLang | SQL |
|-------|-----|
| `EQ(prop, val)` | `prop = val` |
| `NEQ(prop, val)` | `prop <> val` |
| `LT(prop, val)` | `prop < val` |
| `GT(prop, val)` | `prop > val` |
| `AND(a, b)` | `a AND b` |
| `OR(a, b)` | `a OR b` |
| `NOT(a)` | `NOT a` |
| `IN(prop, arr)` | `prop IN (...)` |
| `CONTAINS(prop, str)` | `prop LIKE '%str%'` |
| `STARTS_WITH(prop, str)` | `prop LIKE 'str%'` |
| `orderBy(DESC(prop))` | `ORDER BY prop DESC` |
| `COUNT()` | `SELECT COUNT(*)` |
| `SUM(prop)` | `SELECT SUM(prop)` |

---

## Summary

### Best Practices

1. **Use property shortcuts** — `Person.NAME.eq('John')` is cleaner than `M.EQ(Person.NAME, 'John')`
2. **Compose predicates** — Build complex queries from simple parts
3. **Use appropriate sinks** — COUNT is more efficient than selecting and counting
4. **Leverage GROUP_BY** — Aggregate in the DAO, not in application code
5. **Build queries dynamically** — Use arrays and spread operators for variable conditions

### Common Patterns

```javascript
// Filter + Sort + Paginate
dao.where(M.GTE(Person.AGE, 18))
   .orderBy(M.DESC(Person.SALARY))
   .skip(10)
   .limit(20)
   .select();

// Aggregate statistics
Promise.all([
  dao.select(M.COUNT()),
  dao.select(M.AVG(Person.AGE)),
  dao.select(M.SUM(Person.SALARY))
]).then(([count, avg, sum]) => {
  log('Stats:', count.value, avg.value, sum.value);
});

// Group and aggregate
dao.select(M.GROUP_BY(Person.AGE, M.COUNT()));
```

---

## See Also

- [FOAM DAO By Example](be:dao) — DAO operations and patterns
- [foam.mlang package](https://github.com/kgrgreer/foam3/tree/development/src/foam/mlang) — Source code

<glossary>
  <def term="MLang" definition="Model Language. FOAM's cross-platform query and expression language that compiles to the same AST in JavaScript, Java, and SQL."></def>
  <def term="Predicates" definition="Boolean expressions used to filter data. Implement f(obj) returning true/false. Used in DAO where() clauses."></def>
  <def term="Comparators" definition="Expressions that define sort order. Implement compare(a, b) returning negative, zero, or positive. Used in DAO orderBy()."></def>
  <def term="Expressions" definition="Computations that extract or derive values from objects. Properties, arithmetic, and nested access are all expressions."></def>
  <def term="Sinks" definition="Objects that process results from DAO select(). Implement put(obj) for each result and may aggregate values."></def>
  <def term="EQ" definition="Equals predicate. Tests if a property equals a value or another property."></def>
  <def term="AND" definition="Logical AND predicate. All sub-predicates must be true."></def>
  <def term="OR" definition="Logical OR predicate. Any sub-predicate can be true."></def>
  <def term="NOT" definition="Logical NOT predicate. Negates the sub-predicate."></def>
  <def term="IN" definition="Collection predicate. Tests if a value is contained in an array."></def>
  <def term="CONTAINS" definition="String predicate. Tests if a property contains a substring."></def>
  <def term="DESC" definition="Descending comparator. Reverses the natural sort order of a property."></def>
  <def term="THEN_BY" definition="Compound comparator. Uses second comparator when first returns equal."></def>
  <def term="COUNT" definition="Aggregation sink. Counts the number of results."></def>
  <def term="SUM" definition="Aggregation sink. Sums values of an expression across all results."></def>
  <def term="AVG" definition="Aggregation sink. Computes average of an expression across all results."></def>
  <def term="GROUP_BY" definition="Grouping sink. Groups results by an expression and applies a sink to each group."></def>
  <def term="MAP" definition="Transformation sink. Extracts expression values and passes to another sink."></def>
  <def term="UNIQUE" definition="Deduplication sink. Removes duplicate values based on an expression."></def>
  <def term="SEQ" definition="Sequence sink. Passes each result to multiple sinks in parallel."></def>
  <def term="DOT" definition="Nested property access expression. Extracts properties from nested objects."></def>
  <def term="KEYWORD" definition="Full-text search predicate. Searches across all searchable properties of a model."></def>
</glossary>