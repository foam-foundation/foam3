# Why FOAM? What Makes It Different?

> *"Many people have tried to build a practical model-based programming environment, but these efforts always seem to collapse under their own weight. What are you doing differently this time?"*

## Short Answer

1. We never edit or check in generated code.
2. Design patterns make modelling and meta-programming viable.
3. We generate fine-grained components and compose them with Contexts and Facades.
4. We augment rather than replace the target language.
5. We rely on a small set of strong canonical interfaces.
6. We're Feature-Oriented.
7. Active Models are retained at runtime, enabling data-driven programming.
8. FOAM is itself modelled, keeping it small and uniform.
9. Models are first-class data.
10. Models can be viewed and edited in our MVC framework.
11. Functional Reactive Programming applied to Models enables live coding.
12. FOAM's APIs are RISC-y — designed to be generated, not hand-written — making them small and fast.

---

## Long Answer

### 1. Code Is a Liability

Modelling tools and code generators produce large quantities of code, but that code invariably needs editing to add custom behaviour. Developers load it in their editor and search for `/* insert code here */` comments. While these tools provide a good starting point, developers quickly accumulate more code than they can maintain. It is like winning a luxury home in a lottery but not being able to afford the taxes.

The fundamental problem: **code requires maintenance and is therefore a liability, not an asset**. Code generators are actually liability generators. The real asset is the features the code supplies — what you want is the features, not the code itself.

Our solution is simple: **never generate any code that needs to be edited or checked in**. Generated code exists only as part of the build process or at runtime, never in version control, never manually maintained.

**This principle is more important than ever in the age of AI coding assistants.** An army of agents can generate a mountain of code — but generating code faster does not change its nature as a liability. The maintenance burden accumulates at the same rate as before; only the speed of accumulation has changed. The result is teams drowning in AI-generated code they cannot understand, cannot safely modify, and cannot afford to maintain.

The problem compounds at the download layer. When every screen and every interaction is a hand-authored (or agent-authored) component, client bundles grow without bound. We have seen applications where a single login screen is larger than our entire application — which includes over 400 DAOs, 625 microservices, and hundreds of menus. When bundle sizes become prohibitive, teams switch to server-side rendering as a remedy — trading one set of problems for another — rather than addressing the underlying cause: too much code was generated and retained in the first place.

Code reuse remains important — generating code doesn't eliminate the need for it. A well-designed model-driven system generates *behaviour* at runtime from a compact declaration, not *code* that must be shipped, stored, and maintained. The distinction is the difference between a formula and a printout of its results: one stays small and correct as inputs change; the other must be regenerated and re-shipped every time anything moves.

---

### 2. Modelling Isn't Enough — Good Design Is Still Required

Modellers take you some percentage of the way toward a solution, but you need a way to add the remainder without modifying generated code. The answer is Design Patterns — specifically the *open to extension, closed to modification* principle. Good design allows us to generate software components that can be extended externally through Strategies, Template Methods, Decorators, Composition, and Chain of Responsibility patterns, rather than internally through code modification.

It is unfortunate that code generation fell out of favour just as Design Patterns made it truly practical.

Every time we thought good design didn't matter "because it's just generated code," we were proven wrong. Problems would surface and force us back to fix the underlying design. Code reuse remains important — generating code doesn't eliminate the need for it. Web and mobile applications suffer from large download sizes if the underlying architecture is poor. You are far better off with a poorly designed modeller that produces well-designed systems than a well-designed modeller that produces poorly designed ones.

Since FOAM generates well-designed output and generates itself, the modeller and the systems it produces maintain equivalent quality.

---

### 3. Fine-Grained Components

Rather than generating large monolithic components from Models, we generate many small, fine-grained components designed to work together while remaining individually replaceable, augmentable, and recomposable — more like Lego bricks than diecast toys.

The challenge with fine-grained components is composition: you end up with many small pieces that must be assembled into a working system. We solve this in two ways.

**Context-Orientation** provides implicit hierarchical dependency management, dramatically reducing explicit composition boilerplate. **Facades** create single components that hide the complexity of many smaller ones. For example, FOAM's `EasyDAO` composes many common DAO Strategies and Decorators into a single working composite.

Strategies handle data storage: in-memory MDAO, journalled file storage, JDBC, REST endpoints. Decorators add functionality: sequence number assignment, GUID assignment, logging, profiling, validation, authentication, authorisation, caching. Not all combinations make sense and some conflict, but `EasyDAO` handles this complexity transparently.

```javascript
// One declaration composes a full decorator stack
foam.dao.EasyDAO.Builder(x)
  .setOf(Invoice.getOwnClassInfo())
  .setJournal(true)
  .setCache(true)
  .setAuthorize(true)
  .setSeqNo(true)
  .build()
```

---

### 4. Augment, Don't Replace

We do not try to model 100% of the solution. A 90% solution is perfectly acceptable — in Java we typically generate 80–98% of code, with developers coding the rest in their target language. Much of the custom code is just a few lines: pre/post property setters, custom validation, method bodies. This code lives *inside the model*, embedded in our DSL rather than the other way around. We call this an **inverted internal DSL**.

```javascript
foam.CLASS({
  name: 'Invoice',
  properties: [
    {
      class: 'Currency',
      name: 'amount',
      // Custom validation lives inside the model, not outside it
      validateObj: function(amount) {
        if ( amount <= 0 ) return 'Amount must be positive.';
      }
    }
  ],
  methods: [
    {
      name: 'isOverdue',
      // Custom logic is a few lines inside the declaration
      javaCode: `return getStatus() != InvoiceStatus.PAID && getDueDate().before(new Date());`
    }
  ]
});
```

Our MLang DSL for database queries is, by contrast, a regular internal DSL — designed to be composed programmatically rather than hand-typed character by character.

For specific domains, 100% solutions are achievable. The same modelling approach that drives FOAM's generic views can produce entirely code-free application builders for well-understood domains.

---

### 5. Strong Canonical Interfaces

FOAM reuses a small set of canonical interfaces heavily. Developers implement, decorate, or compose these few:

`DAO` · `View` · `Sink` · `Predicate` · `Comparator` · `Action` · `Agent` · `Parser` · `Validator` · `Authenticator` · `Authorizer` · `Factory` · `Adapter`

More implementations behind fewer interfaces — this is what keeps the system coherent as it grows. A new DAO backend automatically inherits everything that works with DAOs: caching decorators, authorisation decorators, client-server proxying, MLang queries, live listeners. A new View automatically participates in the context system, reactive bindings, and section-based layout.

---

### 6. Feature-Oriented

Features — not classes, not layers, not services — are the primary unit of organisation. A feature is a cohesive vertical slice: the model, the view, the persistence, the network, the validation. Adding a feature means declaring a model; removing a feature means removing the declaration. The system does not accumulate horizontal layer files that must be updated in lockstep whenever a feature changes.

See the [introductory video](https://www.youtube.com/watch?v=n699DWb2TUs) for a demonstration of what this means in practice.

---

### 7. Active Models

FOAM objects retain a reference to their class at runtime via `cls_` — we call these **Active Models**. This enables data-driven programming: code that reflects on or interprets an object's model at runtime to provide functionality for any modelled type. This is the primary alternative to code generation, and FOAM supports both.

```javascript
var john = Person.create({ firstName: 'Jonathan', lastName: 'Edwards' });

// Serialise to JSON — works for any FOAM object
foam.json.stringify(john);
// { "class": "Person", "firstName": "Jonathan", "lastName": "Edwards" }

// Reflect on the class at runtime
john.cls_.id;                         // 'Person'
john.cls_.getAxiomsByClass(foam.core.Property).map(p => p.name);
// ['firstName', 'lastName']
```

This is how `DetailView`, `TableView`, `DAOBrowserView`, JSON adapters, and XML adapters all work for any modelled type with no per-type code.

---

### 8. FOAM Is Itself Modelled

FOAM's meta-model is a FOAM model. In systems like Smalltalk, the meta-model is a tower: instances → classes → metaclasses → meta-metaclasses → … Each level is separately specified, the machinery differs subtly between levels, and the tower has to be grounded by fiat at the top. In practice it fades into irrelevance after two or three levels because the higher meta-levels become too awkward to use. `Meta^n(Model)` grows weaker with each step.

FOAM avoids this by looping back on itself:

```javascript
foam.lang.Model.cls_.id;   // 'foam.lang.Model'
```

`Model.cls_ === Model`. The class that describes all classes is itself an instance of the class it describes. `Meta^n(Model)` for any *n* is always the same object, with the same full machinery and the same descriptive power. There is no tower, no fading, no special case at the top.

This is made possible by **Refinements** — a concept borrowed from the field of knowledge representation — combined with a careful bootstrapping sequence. FOAM1 bootstrapped through a series of increasingly capable models, each one generating the next: a sequence of distinct versions, each subtly different from the last. From FOAM2 onwards, FOAM starts as a small, minimal version of itself and *refines itself in place*, steadily upgrading the same running system rather than generating a successor. Each refinement adds axioms to classes that already exist; existing instances immediately see the improvement.

The analogy is a robot that begins as a simple toy — able to move and follow basic instructions — and progressively upgrades its own motors, sensors, and software until it becomes a full industrial machine. At no point is a new robot built; the original robot is the industrial robot, arrived at through self-improvement. By the time FOAM's bootstrap completes, the Model class has refined itself into something fully capable of describing itself — which is why `cls_ === Model` is a consequence of the process rather than a declaration imposed by fiat.

This self-referential design is the primary reason FOAM remains so small and uniform. There is no special-case meta-layer with its own rules; the same machinery that models your `Invoice` class also models FOAM's own `Property`, `Method`, and `Action` classes.

**This also means FOAM does not ship finished.** The same mechanism that FOAM uses to bootstrap itself is available to any library or user. Other systems offer extension points — plugin APIs, abstract classes, hooks — but these are deliberate gaps left by the framework author for anticipated use cases. They do not let you extend the modelling language itself.

In Java, you cannot add new syntax to the top of a file and then use it in that same file. Adding new syntax to Java means modifying and recompiling the Java compiler itself — a version of the language, not a use of it. The extension mechanism and the thing being extended are at entirely different levels.

In FOAM, you can define a new Axiom type — a new kind of thing a class can declare — and use it immediately in the same codebase, in the same file if you wish. The new feature participates in the full FOAM machinery: it installs into classes, generates code, appears in generic views, serialises to JSON, and propagates to subclasses through refinements, exactly as any built-in Axiom does. There is no separate compiler phase, no version boundary, no privileged layer that only FOAM's authors can touch. User-defined Axioms are indistinguishable from built-in ones because there is no distinction in the machinery — only in who wrote them.

---

### 9. Models Are First-Class Data

Everyone says "code is data," but very rarely is it truly first-class data. Because FOAM Models are modelled, you can do anything with them that you do with any other modelled data: display in an MVC View, store in a DAO, query with MLang, serialise to JSON or XML, send across a network.

Meta-programming becomes regular programming. A refactoring tool applies an MLang query to a DAO of Models exactly as an accounting application applies an MLang query to a DAO of invoices. The same generic code handles both.

---

### 10. MVC Works on Code

MVC excels at creating applications that view or edit data, with multiple views staying synchronised automatically. Because FOAM Models are first-class data, the same MVC machinery works on code.

You can simultaneously view and edit a Model in a JSON editor, a property-list editor, a graphical view, and a UML diagram — updates in any one are immediately reflected in all others. Creating a new type of model editor requires no special framework support; you write a View that takes a Model as its `data`, exactly as you would for any other FOAM object.

---

### 11. Functional Reactive Programming

FOAM makes extensive use of FRP through its slot system. Every property produces a reactive slot that can be subscribed, composed, mapped, and linked without callbacks or manual event wiring:

```javascript
// Derive a live value from two properties — updates automatically
var fullName = this.slot(function(firstName, lastName) {
  return firstName + ' ' + lastName;
});

// Bind it directly into the DOM — updates in place with no re-render
this.start('h2').add(fullName).end();
```

This eliminates most lifecycle callbacks, simplifies MVC synchronisation, and makes live coding natural: changing a model property immediately and precisely updates every view that depends on it.

---

### 12. RISC-y APIs

FOAM's internal APIs — the U2/U3 view library, the MLang query system, the parser combinators — are designed to be generated by FOAM rather than written by hand. This makes them small, regular, and fast, in the same way that RISC processor instruction sets are small and fast because they target compilers rather than human assembly programmers.

This is why FOAM's view library is a fraction of the size of conventional UI frameworks, and why it had to be written from scratch: every existing library was optimised for human authorship, not programmatic generation. See [RISCyAPIs.md](RISCyAPIs.md) for a full treatment of this principle, including why it also makes FOAM unusually well-suited to LLM-driven development — an application that was not part of the original design but follows from the same underlying reasoning.

---

## The Common Thread

Several points above express different facets of the same core philosophy:

- **Models are first-class.** They are data, they are retained at runtime, they are stored in DAOs, they are displayed in views, they generate themselves.
- **Generated code is ephemeral.** It is never checked in, never edited, never a maintenance burden.
- **Good design is non-negotiable.** Automation does not eliminate the need for well-designed output; it amplifies whatever design you bake in.
- **Small, composable, canonical.** A few interfaces, many implementations, composed by context and facade — not a large menu of bespoke solutions.

Model-based programming environments have collapsed before because they tried to generate code that still needed to be maintained, produced monolithic output that could not be composed, or created a meta-layer that was separate from and more complex than the system it described. FOAM avoids each of these failure modes by design.
