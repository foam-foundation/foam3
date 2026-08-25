# Key FOAM Concepts

## Meta-Programming

FOAM is a meta-programming system: a program that generates and/or manipulates other programs. For compiled languages like Java, it does this through code generation. For JavaScript it mainly works by dynamically constructing prototypes as maps of functions at runtime.

Examples of meta-programming include Lisp macros, C++ templates, Unix's M4 macro processor, the OMG's Model-Driven Architecture (MDA), and most code generators. JavaScript is arguably the world's most popular meta-programming language — there is no distinction between compile time and runtime, and the language has no built-in syntax for declaring classes. Instead, programs build their own class structures at runtime, which is itself a form of meta-programming. All object-oriented JavaScript programs are therefore already meta-programs: programs that generate programs.

What is rare is exploiting this capability intentionally and systematically. FOAM does exactly that.

## Model-Oriented

FOAM is model-oriented: it *models* programming entities — classes, prototypes, objects, relationships, enumerations. Models are higher-level abstract definitions that can be compiled to lower-level targets such as JavaScript or Java. FOAM is a textbook Model-Driven Development (MDD) system.

```javascript
// A model is a declaration of what something IS, not how it works
foam.CLASS({
  package: 'com.example',
  name: 'Invoice',
  properties: [
    { class: 'String',   name: 'invoiceNumber' },
    { class: 'Currency', name: 'amount' },
    { class: 'Date',     name: 'dueDate' },
    { class: 'Enum',     name: 'status', of: 'com.example.InvoiceStatus' }
  ]
});
```

From this single declaration FOAM generates getters, setters, change notification, validation, serialisation, UI components, and storage adapters — across all targeted platforms.

## Feature-Oriented

Like Unix, FOAM is feature-oriented. Reusable feature-components add functionality to any underlying data source (Model). In Unix, feature-commands like `sort`, `grep`, and `more` compose with data sources like `cat`, `ls`, and `ps` through the pipe. Feature-orientation offers exponentially better productivity — in a mathematical rather than marketing sense — compared with approaches that require common features to be re-implemented for each data source.

Unix, however, provides feature-orientation only for text and command-line programs. FOAM extends this to graphical interfaces, the web, and multi-tier applications.

The canonical FOAM example is `EasyDAO`: a single declaration that composes persistence, caching, authorisation, sequence number assignment, logging, and validation into a working stack:

```javascript
foam.dao.EasyDAO.Builder(x)
  .setOf(Invoice.getOwnClassInfo())
  .setJournal(true)
  .setCache(true)
  .setAuthorize(true)
  .setSeqNo(true)
  .build()
```

Each capability is an independent decorator. Any DAO backend — in-memory, JDBC, REST — automatically gains caching, authorisation, and the rest, with no per-backend code.

## Meta-Circular

FOAM is written in itself: the Model is itself a modelled class. This normally leads to infinite regress — a meta-model that requires a meta-meta-model, and so on — but FOAM breaks the loop by folding back on itself:

```javascript
foam.lang.Model.cls_.id;   // 'foam.lang.Model'
```

The class that describes all classes is an instance of itself. This is made possible by FOAM's bootstrapping technique, **Refinements** — a concept borrowed from the field of knowledge representation, where a knowledge base can be incrementally extended and corrected without replacing it wholesale.

The key distinction from earlier approaches: FOAM1 bootstrapped through a *sequence of increasingly capable models*, each one used to generate the next. The output of stage N was a better modelling system that became the input to stage N+1. This worked, but it meant the bootstrap process carried multiple distinct versions of the framework simultaneously, each subtly different from the last.

From FOAM2 onwards, bootstrapping works differently. FOAM starts as a small, minimal version of itself — capable enough to understand a model declaration and install axioms — and then *refines itself in place*, steadily adding capabilities to the same running system rather than generating a successor. Each refinement adds properties, methods, or behaviours to classes that already exist, and the existing instances immediately see the improvement.

The analogy is a robot that begins life as a simple toy — able to move and follow basic instructions — and then progressively upgrades its own motors, sensors, and software until it becomes a full industrial machine. At no point is a new robot built; the original robot is the industrial robot, arrived at through self-improvement. This is why `foam.lang.Model.cls_ === foam.lang.Model` is not a special-case declaration but a natural consequence of the process: by the time the system is fully bootstrapped, the Model class has refined itself into something capable of describing itself completely.

See [Refinements.md](Refinements.md) for the mechanical details of how refinements install axioms into existing classes and propagate changes to subclasses.

In systems like Smalltalk, the meta-model hierarchy is a tower: instances → classes → metaclasses → meta-metaclasses → … Each level is a distinct, separately specified thing, and the tower eventually has to be grounded by fiat — the top level is declared to be its own class by special rule, not because the system naturally closes on itself. The machinery at each level is subtly different from the levels below, which means the system accumulates special cases and grows more complex the higher you go. In practice the tower fades into irrelevance after two or three levels because the higher meta-levels become too awkward to use.

FOAM's self-referential design means there is no tower. `Meta^n(Model)` for any *n* is always the same object — `foam.lang.Model` — with the same full machinery, the same properties, the same axiom system. The descriptive power does not weaken as you ascend. This is not achieved by a special rule at the top; it follows from the ordinary FOAM class machinery applied to itself during bootstrapping.

The practical consequence is that FOAM remains very compact. There is no separate special-case meta-layer with its own rules; the same machinery that models your `Invoice` class also models FOAM's own `Property`, `Method`, `Action`, and `Listener` axiom classes. Adding a new kind of axiom is just adding a new FOAM class.

**This also means FOAM does not ship finished.** The bootstrapping mechanism is not internal-only; it is available to any library or user. Other systems offer extension points — plugin APIs, hooks, abstract base classes — but these are deliberate gaps left open for anticipated use cases. They do not let you extend the modelling language itself.

In Java, you cannot add new syntax at the top of a file and use it in that same file. Extending Java's syntax means recompiling the Java compiler — producing a new version of the language, not using the existing one. The extension mechanism and the thing being extended live at different, unreachable levels.

In FOAM, you can define a new Axiom type and use it immediately in the same codebase. The new Axiom participates in the full FOAM machinery: it installs into classes, generates code, appears in generic views, serialises to JSON, and propagates to subclasses through refinements — exactly as any built-in Axiom does. There is no privileged layer that only FOAM's authors can touch. User-defined Axioms are indistinguishable from built-in ones because the machinery makes no distinction between them.

## Code is Data

Wherever possible FOAM uses a declarative, data-driven approach. Much of an application's definition takes the form of declarative data rather than executable code. This enables:

- **Higher productivity** — declare intent rather than describe steps
- **Lower barrier to entry** — a junior developer can read and extend a declaration
- **Easy tooling** — a declaration is just data; it can be queried, transformed, and displayed
- **Platform independence** — the same declaration can be compiled to a new target without modifying the original model

Because FOAM Models are themselves modelled FObjects, you can store them in DAOs, query them with MLang predicates, send them across a network, and display them in views — using the same generic code you use for application data. Meta-programming becomes regular programming.

```javascript
// Models are data — query them like any other DAO
var classesByPackage = await foam.lang.ModelDAO
  .where(M.STARTS_WITH(foam.lang.Model.PACKAGE, 'com.example'))
  .select(M.GROUP_BY(foam.lang.Model.PACKAGE, M.COUNT()));
```

When your code is data, your code base becomes a database.

## MVC

FOAM is a full Model-View-Controller framework that decomposes user-interface code into three distinct layers:

- **Model** — the layer responsible for representing data
- **View** — the layer responsible for presenting data to the user
- **Controller** — the layer responsible for mediating between Model and View

Because FOAM Models are first-class data (see above), MVC works on code itself. A Model can be displayed in a JSON editor, a property-list editor, a graphical diagram, and a UML view simultaneously — updates in any one are immediately reflected in all others. Creating a new kind of model editor requires no special framework support; you write a View that takes a Model as its `data`, exactly as you would for any other FOAM object.

> **The four meanings of "Model" in FOAM.** Being simultaneously an MVC framework and a modelling framework means the word "Model" is legitimately overloaded — and all four meanings are coherent:
>
> 1. **MVC Model** — any FObject used as the `data` of a View; the thing being observed and displayed.
> 2. **Class declaration** — the object produced by `foam.CLASS({...})`; a runtime `foam.lang.Model` instance describing a class's structure: its properties, methods, actions, and axioms.
> 3. **Domain object / instance** — a concrete object created by `Invoice.create()`; a modelled entity in the application domain. This is what most developers mean by "a model" in everyday speech.
> 4. **The meta-model** — `foam.lang.Model` itself: the FOAM class that describes all other class declarations. It is simultaneously a class declaration (sense 2) and a domain object (sense 3), and is described by itself — the meta-circular property described above.
>
> Senses 2, 3, and 4 collapse cleanly: every class declaration is a domain object that is an instance of `foam.lang.Model`, which is itself described by a class declaration. The MVC sense (1) is orthogonal — any of the others can serve as an MVC Model simply by being passed as `data` to a View.

## View Components

FOAM's UI creation model is based on component composition rather than direct HTML and DOM manipulation. View components may themselves be implemented using HTML and DOM, but most application developers work with pre-built components rather than with raw markup — the same way GUI developers use Button and Label widgets rather than drawing pixels themselves.

This approach has three key advantages.

**Consistent look and feel.** When developers reuse a standard component library rather than authoring markup for each use, every Button, Label, Table, and Form is actually the same implementation, styled consistently by default.

**Encapsulation.** All DOM manipulation is hidden inside the component. The component exposes only public properties, events, and methods — not the underlying DOM tree. Directly manipulating another component's DOM would be as fragile as reaching into another object's private fields. FOAM's component model makes this impossible by construction.

**Technology independence.** By encapsulating the implementation behind a standard component interface, a view is free to use HTML, Canvas, WebGL, SVG, or a native control internally — and the rest of the application never knows or cares. FOAM unifies the composition, event, animation, storage, and configuration aspects of all these technologies.

FOAM components are completely self-contained, including their default CSS. No external stylesheet is required for a component to render correctly. Designers may still restyle components, but by default there are no external dependencies and no global CSS namespace collisions.

## Read-Optimised

FOAM models are *declarations of requirements*, not implementations. The framework derives the implementation from the declaration at build time or at runtime.

This has a dramatic effect on code size. A FOAM model targeting a given platform is typically around **50× smaller** than the equivalent hand-authored implementation for that platform alone. The model does not grow for each additional platform it targets; the same compact declaration produces JavaScript, Java, and Swift simultaneously.

The benefit is not just quantity. Each line of a FOAM model is also *simpler* than its implementation counterpart — it states a fact ("this property is a Currency") rather than a procedure ("allocate storage, generate a getter, register a change handler, emit a serialisation descriptor…"). Reading a FOAM model tells you what the system *is*; reading the generated implementation tells you *how* it was built. The former is almost always what developers need.

All FOAM code also follows the same structure: every class is a `foam.CLASS({...})` with the same sections in the same order — `properties`, `methods`, `listeners`, `actions`. There is no variation in style or idiom to learn per file. This uniformity dramatically reduces the cognitive overhead of navigating a large FOAM codebase.

This matters more than it might seem, because studies consistently show that developers **spend more time reading code than writing it**. A system that is ten times smaller and structurally uniform reduces reading cost by an order of magnitude — a compounding advantage as the system grows.

## Reactive Programming

FOAM's reactive programming model is rooted in a 2007 system called [Flapjax](http://www.flapjax-lang.org/tutorial/), which introduced *behaviors* — values that change over time and automatically propagate their changes to anything that depends on them. When it came time to design FOAM, the concept was borrowed and integrated into the slot and expression system.

The Flapjax documentation explains the core idea better than most:

> **The Spreadsheet Grew Up**
>
> Spreadsheets are a good idea. Not in the sense that it's fun to spend all day crunching numbers arranged in rows and columns; rather, in the sense that they let you express dependencies between cells, then automatically perform the "heavy lifting" of propagating these dependencies. They are, in some respect, the ultimate kind of declarative programming language…
>
> Behaviors are essentially the natural extension of the spreadsheet model… they are still in the spreadsheet mould of expressing dependencies and letting the language sort out the propagation of values. Like most spreadsheets, Flapjax has optimizations to avoid wasteful computation…
>
> One way of viewing Flapjax, then, is that it tries to reconcile two important programming styles that have needlessly been in conflict: declarative and imperative programming. Imperative programs often put too much book-keeping burden on the programmer; where the programmer fails, the program generates errors owing to inconsistencies… Flapjax fully embraces mutation — behaviors are entirely built around the existence of mutation — but encourages programmers to describe their systems declaratively, pushing the burden of propagating these changes through the declarative specification onto the language. In short, Flapjax programs tend to be declarative specifications over imperative data.
>
> — *[Flapjax Tutorial](http://www.flapjax-lang.org/tutorial/)*

This is exactly FOAM's approach. You declare *what depends on what*; the framework propagates changes automatically:

```javascript
// Declare a derived value — the framework handles updates
var total = this.slot(function(lineItems) {
  return lineItems.reduce((s, li) => s + li.price * li.qty, 0);
});

// Bind it to the DOM — updates automatically when total changes
this.start('span').add(total).end();
```

There is no `addEventListener`, no manual re-render call, no state synchronisation loop. You declare the reactive intent — "this value depends on these properties" — and the underlying system propagates changes and may apply any performance optimisations it sees fit, such as batching updates to the animation frame or short-circuiting propagation when a value has not actually changed.

This is the same principle that makes spreadsheets productive: a formula cell describes a relationship, not a procedure. The spreadsheet engine decides when and how to recompute. FOAM's slot system brings this model to application code, eliminating most of the bookkeeping that reactive UI frameworks require developers to manage by hand.

> **A note on terminology.** The word "reactive" has since been adopted — and diluted — by many systems that do not maintain the full power of functional reactive programming. A framework that requires you to explicitly declare dependency arrays, call update functions, or structure code around observable streams is shifting the propagation bookkeeping back onto the programmer. That is a weaker form of reactivity: the system responds to events you explicitly wire up, rather than automatically tracking and propagating dependencies from ordinary expressions. True FRP, as in Flapjax and FOAM, means the programmer writes the *what* — a plain expression or slot derivation — and the runtime handles *all* of the when and how. The spreadsheet analogy is the test: in a spreadsheet you never tell a formula cell when to recalculate. If you have to, your system is not fully reactive.
