# The Power of DSLs in FOAM

FOAM demonstrates a masterclass in the use of Domain Specific Languages. Consider how a simple query parser is constructed: FOAM's parser combinators form an *internal DSL* for creating *external DSLs*. These combinators are used to compile AQL (Autocomplete Query Language), an external DSL, into MLangs, which are themselves an internal DSL for predicates.

This creation is guided by information from `foam.CLASS`, which is itself an internal DSL for defining classes. This is unusual—class syntax is typically provided as part of an external general-purpose language like Java or C++. But FOAM's approach shows its advantage here in ways that wouldn't be possible with the conventional approach.

## DSLs All the Way Down

Each layer provides leverage for the next:

**foam.CLASS** — An internal DSL for defining classes. Because it's data rather than syntax, it's introspectable. The parser can ask "what properties does this class have? what types are they?" This would be impossible if classes were just Java or C++ syntax compiled away.

**Parser Combinators** — An internal DSL for defining grammars. Composable, debuggable, and extensible in the host language. No separate toolchain, no generated files to keep in sync.

**AQL** — An external DSL for end users. Clean, domain-appropriate syntax for queries. Non-programmers can use it in search bars and filters.

**MLang** — An internal DSL for predicates. Composable, serializable, and optimizable. MLangs can be sent to the server, translated to SQL, or partial-evaluated for performance.

## The Power of Composition

The key insight is that internal DSLs *compose* in ways external DSLs cannot.

The AQL parser doesn't just parse text—it introspects the CLASS model to discover which properties exist and what operators each type supports. A String property offers `CONTAINS`; a Date property offers `IN RANGE`. The grammar is *parameterized by* the data model.

MLangs don't just represent queries—they can be optimized, combined, and shipped across the wire. The predicates directly reference the class model's property objects. Everything is connected.

Compare this to the traditional approach: write a parser that outputs an AST, write an interpreter for the AST, manually keep the schema in sync with both. Every layer is isolated; nothing knows about anything else.

In FOAM, each layer is built on—and has access to—the layers below. The grammar adapts to the model. The predicates compose with the properties. A change to the class definition automatically propagates to what the query parser accepts.

## Conclusion

The real power of FOAM's DSL architecture isn't just that you *can* build DSLs easily—it's that they *collaborate*. Each language is aware of and leverages the others, creating a unified system far more capable than its individual parts.

This is what model-driven development looks like when taken seriously: not just generating code from models, but building languages that understand and work with those models at every level.
