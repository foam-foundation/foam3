# RISC-y APIs

## The Analogy

The history of CPU design contains a lesson that applies directly to framework design.

Early computers were programmed mostly in assembly language, so CPU architects built **CISC** (Complex Instruction Set Computer) processors. It mattered enormously how convenient the instruction set was for a human to write by hand. CISC chips accumulated large instruction sets with many addressing modes, high-level memory operations, and string-manipulation instructions baked into silicon — all to make the assembler programmer's life easier. That convenience came at a real cost: the hardware grew more complex, clock speeds were constrained, and the internal microarchitecture had to do an increasing amount of work to decode and execute the sprawling instruction set.

Then high-level languages became dominant. Humans stopped writing assembly. Compilers wrote assembly instead. And CPU designers realised something important: **the compiler does not care whether an instruction is convenient to type**. A compiler cares whether the instruction set is small, orthogonal, fast, and regular — qualities that make it easy to generate correct sequences and easy for the hardware to execute them efficiently. This insight produced **RISC** (Reduced Instruction Set Computer) processors: much smaller instruction sets that were harder for a human to program in directly, but ideal for compilers to target. The result was faster, simpler hardware.

The lesson: *who is writing the code changes what a good API looks like.*

## FOAM as the Compiler

FOAM is built around exactly this insight, applied to application development.

In a conventional stack, a human developer is the direct consumer of every API: the DOM API, the UI framework, the ORM, the query language. The framework designer's job is to make those APIs pleasant for a human to read and write. This produces CISC-style APIs — rich, expressive, full of conveniences and syntactic sugar, often large and complex as a result.

In a FOAM application, FOAM itself is the primary consumer of most of its own subsystem APIs. A developer writes a model declaration — properties, methods, relationships — and FOAM generates the UI, the persistence layer, the network protocol, and the validation logic from that declaration. The human writes the specification; FOAM writes the implementation.

This changes what a good API looks like across the entire framework. APIs that FOAM generates rather than humans write can afford to be RISC-y: small, regular, fast, and designed for programmatic composition rather than human ergonomics. The result is subsystems that are significantly smaller and faster than their CISC counterparts in conventional frameworks.

## Case Study: The U2/U3 View Library

This is the most direct application of the principle, and the reason FOAM had to write its own UI library rather than use an existing one.

Every major UI library of FOAM's era was built around the assumption that a human developer hand-authors each component. React's JSX, Angular's templates, Polymer's HTML bindings, Svelte's `.svelte` files — all are optimised to be pleasant for a human to read and write. They are CISC-style: richly featured, with syntax designed for human cognition.

FOAM needed a UI library that FOAM itself would generate. A FOAM `DetailView` does not know ahead of time which model it will display; it introspects the model at runtime and programmatically constructs the appropriate field for each property. A `DAOBrowserView` constructs a full search/browse/edit/create interface from a DAO and its model, with no per-model code.

This kind of reflection-driven generation does not need — and is actively hindered by — human-ergonomic features:

- **Template compilation** requires knowing the component structure at build time. FOAM's views are assembled at runtime from model metadata.
- **JSX/template syntax** is designed to be read by humans. Code that generates UI programmatically doesn't benefit from readable syntax; it needs composable function calls.
- **Virtual DOM diffing** is designed for hand-authored component trees where the framework cannot know in advance what changed. FOAM's slot system tracks changes precisely at the property level, making full-tree diffing unnecessary overhead.
- **Named component registries** require the developer to explicitly declare which components exist. FOAM generates components for any model without prior registration.

FOAM's U2/U3 fluent builder API is deliberately RISC-y:

```javascript
// The entire "instruction set": start, end, add, attrs, css, on, show, hide...
this.start('div').addClass('row')
  .start('label').add(prop.label).end()
  .start().add(prop.__).end()
.end()
```

A human can read this, but it was not designed for a human to write. It was designed for FOAM to generate. The result is a view library that is notably compact — far smaller than any of the CISC-style alternatives — and fast, because it carries none of the machinery those alternatives need to support human-authored components.

The same principle produces the generic views that make FOAM productive:

```javascript
// Works for any FOAM model — no per-model code
function render() {
  var self = this;
  this.data.cls_.getAxiomsByClass(foam.core.Property).forEach(function(prop) {
    if ( prop.hidden ) return;
    self.start().add(prop.__).end();
  });
}
```

`DetailView`, `TableView`, `DAOBrowserView`, and `SectionedDetailView` all work this way. One implementation, every model, zero hand-authored per-type components. This is only possible with a RISC-y API.

## Case Study: MLang and the DAO Query API

MLang is FOAM's query language for DAOs. Rather than a human-readable query DSL (SQL, GraphQL, OData), MLang is a composable tree of plain JavaScript objects:

```javascript
M.AND(
  M.EQ(Invoice.STATUS, InvoiceStatus.OPEN),
  M.GT(Invoice.AMOUNT, 0),
  M.LT(Invoice.DUE_DATE, new Date())
)
```

A human *can* write this, and the style is fairly readable. But MLang was not designed to replace SQL for human authors; it was designed to be constructed programmatically by FOAM views, rules, decorators, and query optimisers. A `FilterView` builds an MLang predicate from the user's filter selections at runtime. An authorisation decorator prepends an `AND(EQ(SPID, userSpid), ...)` to every query without the application code being aware of it. A caching DAO inspects the predicate tree to decide whether cached results satisfy the query.

Because the primary consumers are code, not humans, MLang can be a small set of orthogonal predicate and expression classes rather than a parser for a rich query language. Each class does one thing and composes cleanly with the others. The entire predicate vocabulary is a handful of types: `EQ`, `NEQ`, `GT`, `GTE`, `LT`, `LTE`, `IN`, `AND`, `OR`, `NOT`, `CONTAINS`, `STARTS_WITH`, `HAS`. That is the whole instruction set.

The same predicate tree is used for:
- Filtering in-memory `MDAO` collections
- Generating SQL `WHERE` clauses in `JDBCDAO`
- Serialising queries over the network in `ClientDAO`
- Applying authorisation constraints in decorator DAOs
- Driving `FilterView` UI state

One small, composable API serves all of these consumers because the API was designed for programmatic use, not human convenience.

## Case Study: The Parser Combinator Library

FOAM's parser library follows the same pattern. Rather than a parser-generator (yacc, ANTLR) with its own DSL and code generation step, FOAM's parsers are composed from a small set of combinator functions:

```javascript
function grammar(seq, alt, repeat, str, range, chars, sym, optional) {
  return {
    START:      sym('document'),
    digit:      range('0', '9'),
    letter:     alt(range('a','z'), range('A','Z')),
    number:     str(repeat(sym('digit'), null, 1)),
    identifier: str(seq(sym('letter'), repeat(alt(sym('letter'), sym('digit')), null, 0)))
  };
}
```

The combinator functions (`seq`, `alt`, `repeat`, `str`, `range`, `chars`, `optional`, `sym`) are the instruction set. They are small, orthogonal, and composable. A human writes the grammar declaration; the library generates the parser. The grammar itself is data — a plain JavaScript object — which means it can be inspected, extended, and transformed programmatically.

## Implications for AI-Driven Development

The RISC principle has an unexpected extension that was not part of the original design: large language models are also compilers, in the relevant sense, and FOAM's RISC-y APIs are well-suited to them for exactly the same reasons.

An LLM generating FOAM code reads a specification — a natural-language description of a feature — and emits a FOAM model declaration. For this to work well, FOAM's model API needs to be what every RISC instruction set needs to be: **small, regular, and consistent**. An LLM should not need to choose between five different ways to declare a computed property; there should be one right way. It should not need to remember hundreds of special-case options; the vocabulary of axioms should be compact and orthogonal.

FOAM's declarative structure maps unusually well to how LLMs generate code. A human says "I need an Invoice with a status, an amount, and a method to check whether it is overdue." An LLM produces:

```javascript
foam.CLASS({
  name: 'Invoice',
  properties: [
    { class: 'Enum',     name: 'status', of: 'InvoiceStatus' },
    { class: 'Currency', name: 'amount' },
    { class: 'Date',     name: 'dueDate' }
  ],
  methods: [
    function isOverdue() {
      return this.status !== InvoiceStatus.PAID &&
             this.dueDate < new Date();
    }
  ]
});
```

The LLM does not generate getters, setters, change notification, serialisation, validation wiring, or UI code — FOAM generates all of that from the declaration. The LLM's "output instruction set" is small and regular. This is the same advantage RISC gives to compilers: a small, predictable target produces better output than a large, irregular one.

The analogy holds all the way down. Just as a RISC processor was designed for traditional compilers but proved to be the right architecture for modern superscalar and out-of-order execution as well, FOAM's RISC-y APIs were designed for the framework itself as the "compiler," but turn out to be the right architecture for LLM-driven development too. The original motivation and the new application point at the same underlying principle: when a machine is writing the code, a small regular API beats a large convenient one.

## Why This Matters

The RISC/CISC distinction has practical consequences beyond elegance:

**Size.** A RISC-y API does not accumulate the features needed to make human authorship convenient. FOAM's view and query subsystems are a fraction of the size of their CISC counterparts in conventional frameworks. Smaller code is easier to understand, easier to test, and easier to optimise.

**Speed.** A RISC-y runtime does not pay the overhead of features designed for human convenience that programmatic callers never use. Virtual DOM diffing, rich query-DSL parsing, template compilation — all absent because FOAM does not need them.

**Correctness.** When FOAM generates UI from a model, it cannot make a typo or forget to wire a change handler. The "human" part of the system is the model declaration; the FOAM-generated parts are always consistent with it. A CISC-style API that a human assembles manually is only as correct as the human's attention to detail at every call site.

**Generality.** A small, composable API generalises further than a large, special-purpose one. The same MLang predicate tree drives in-memory filtering, SQL generation, network serialisation, and UI filter state. The same U2 builder API generates custom hand-authored views and fully automatic reflection-driven views. Orthogonal primitives compose into more combinations than a fixed menu of high-level operations ever can.

The RISC insight — that the right API depends on who is writing the code — is not a minor implementation detail. It is a load-bearing design principle that runs through FOAM's entire architecture.
