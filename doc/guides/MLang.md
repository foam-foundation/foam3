## FOAM MLang Examples

MLang (Model Language) is FOAM's domain-specific language for queries, predicates, and expressions that works consistently across Java and JavaScript [1](#0-0) .

### Java Examples

In Java, use static imports from `foam.mlang.MLang`:

```java
import static foam.mlang.MLang.*;

// Basic predicates
Predicate p1 = EQ(User.NAME, "John");
Predicate p2 = GT(User.AGE, 25);
Predicate p3 = AND(p1, p2);
Predicate p4 = OR(EQ(User.STATUS, "ACTIVE"), IN(User.ROLE, Arrays.asList("ADMIN", "MANAGER")));

// Aggregation sinks
Sink countSink = COUNT();
Sink sumSink = SUM(User.SALARY);
Sink groupBySink = GROUP_BY(User.DEPARTMENT, COUNT());

// Using with DAO
dao.where(AND(GT(User.AGE, 18), EQ(User.STATUS, "ACTIVE")))
   .orderBy(DESC(User.CREATED_DATE))
   .select(countSink);
``` [2](#0-1)

### JavaScript Examples

In JavaScript, implement the `Expressions` mixin or use `ExpressionsSingleton`:

```javascript
// Option 1: Implement Expressions mixin
foam.CLASS({
  name: 'MyController',
  implements: ['foam.mlang.Expressions'],
  methods: [
    async function loadUsers() {
      return (await this.dao.where(
        this.AND(
          this.GT(User.AGE, 25),
          this.EQ(User.STATUS, 'ACTIVE')
        )
      ).select()).array;
    }
  ]
});

// Option 2: Use ExpressionsSingleton
const M = foam.mlang.ExpressionsSingleton.create();

// Basic predicates
const p1 = M.EQ(User.NAME, 'John');
const p2 = M.GT(User.AGE, 25);
const p3 = M.AND(p1, p2);
const p4 = M.OR(M.EQ(User.STATUS, 'ACTIVE'), M.IN(User.ROLE, ['ADMIN', 'MANAGER']));

// Aggregation sinks
const countSink = M.COUNT();
const sumSink = M.SUM(User.SALARY);
const groupBySink = M.GROUP_BY(User.DEPARTMENT, M.COUNT());

// Using with DAO
const results = await dao.where(
  M.AND(M.GT(User.AGE, 18), M.EQ(User.STATUS, 'ACTIVE'))
).orderBy(M.DESC(User.CREATED_DATE))
 .select(countSink);
``` [3](#0-2)

### Formula Examples

MLang also supports mathematical formulas:

```javascript
// JavaScript formula examples
const E = foam.mlang.ExpressionsSingleton.create();

// Basic arithmetic
E.ADD(1, 2, 3, 4, 5).f() === 15
E.SUB(9, 1, 2, 3, 4).f() === -1
E.MUL(1, 2, 3, 4, 5).f() === 120

// Nested formulas
E.DIV(1, E.ADD(2, E.MUL(3, E.SUB(4, 5)))).f() === -1
``` [4](#0-3)

### Query Parser Integration

MLang integrates with FOAM's query parsers to convert strings to predicates:

```java
// Java SimpleQueryParser
SimpleQueryParser parser = new SimpleQueryParser(User.getClassInfo());
Predicate predicate = parser.parseString("age>25 AND status=ACTIVE");
``` [5](#0-4)

```javascript
// JavaScript QueryParser
const parser = foam.parse.QueryParser.create({ of: User });
const predicate = parser.parseString('age>25 AND status=ACTIVE');
``` [6](#0-5)

## Notes

- MLang predicates are serializable and can be sent between client and server [7](#0-6)
- The `Expressions` mixin provides convenient shorthand methods for all MLang operations [8](#0-7)
- MLang expressions can reference properties directly (e.g., `User.NAME`) which provides type safety and introspection [9](#0-8)
- Custom functions can be created using `FUNC` in JavaScript, though they can't be optimized by the DAO like standard MLang predicates [10](#0-9)
