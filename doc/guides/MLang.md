<flow name="MLang" category="DOC/GUIDE" spid="foam" description="Reference for MLang predicates (EQ/GT/AND/OR/IN/CONTAINS), aggregation sinks, and ordering, in both Java and JS style." keywords="mlang,predicates,eq,sinks,query,knowledge"/>

## FOAM MLang Examples

MLang (Model Language) is FOAM's domain-specific language for queries, predicates, and expressions that works consistently across Java and JavaScript.

The examples below use a hypothetical `Employee` model with `name`, `age`, `status`, `role`, `salary`, `department` and `createdDate` properties.

### Java Examples

In Java, use static imports from `foam.mlang.MLang`:

```java
import static foam.mlang.MLang.*;

// Basic predicates
Predicate p1 = EQ(Employee.NAME, "John");
Predicate p2 = GT(Employee.AGE, 25);
Predicate p3 = AND(p1, p2);
Predicate p4 = OR(EQ(Employee.STATUS, "ACTIVE"), IN(Employee.ROLE, Arrays.asList("ADMIN", "MANAGER")));

// Aggregation sinks
Sink countSink = COUNT();
Sink sumSink = SUM(Employee.SALARY);
Sink groupBySink = GROUP_BY(Employee.DEPARTMENT, COUNT());

// Using with DAO
dao.where(AND(GT(Employee.AGE, 18), EQ(Employee.STATUS, "ACTIVE")))
   .orderBy(DESC(Employee.CREATED_DATE))
   .select(countSink);
```

### JavaScript Examples

In JavaScript, implement the `Expressions` mixin or use `ExpressionsSingleton`:

```javascript
// Option 1: Implement Expressions mixin
foam.CLASS({
  name: 'MyController',
  implements: ['foam.mlang.Expressions'],
  methods: [
    async function loadEmployees() {
      return (await this.dao.where(
        this.AND(
          this.GT(Employee.AGE, 25),
          this.EQ(Employee.STATUS, 'ACTIVE')
        )
      ).select()).array;
    }
  ]
});

// Option 2: Use ExpressionsSingleton
const M = foam.mlang.ExpressionsSingleton.create();

// Basic predicates
const p1 = M.EQ(Employee.NAME, 'John');
const p2 = M.GT(Employee.AGE, 25);
const p3 = M.AND(p1, p2);
const p4 = M.OR(M.EQ(Employee.STATUS, 'ACTIVE'), M.IN(Employee.ROLE, ['ADMIN', 'MANAGER']));

// Aggregation sinks
const countSink = M.COUNT();
const sumSink = M.SUM(Employee.SALARY);
const groupBySink = M.GROUP_BY(Employee.DEPARTMENT, M.COUNT());

// Using with DAO
const results = await dao.where(
  M.AND(M.GT(Employee.AGE, 18), M.EQ(Employee.STATUS, 'ACTIVE'))
).orderBy(M.DESC(Employee.CREATED_DATE))
 .select(countSink);
```

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
```

### Query Parser Integration

MLang integrates with FOAM's query parsers to convert strings to predicates:

```java
// Java SimpleQueryParser
SimpleQueryParser parser = new SimpleQueryParser(Employee.getOwnClassInfo());
Predicate predicate = parser.parseString("age>25 AND status=ACTIVE");
```

```javascript
// JavaScript QueryParser
const parser = foam.parse.QueryParser.create({ of: Employee });
const predicate = parser.parseString('age>25 AND status=ACTIVE');
```

## Notes

- MLang predicates are serializable and can be sent between client and server
- The `Expressions` mixin provides convenient shorthand methods for all MLang operations
- MLang expressions can reference properties directly (e.g., `Employee.NAME`) which provides type safety and introspection
- Custom functions can be created using `FUNC` in JavaScript, though they can't be optimized by the DAO like standard MLang predicates
