# FOAM3 vs Web Components (and Polymer)

## A Note on Comparisons

Before diving into a feature-by-feature comparison, it is worth pausing on a more fundamental observation: comparing FOAM to Web Components — or to any single library — misses the point of what FOAM is trying to do.

A modern web application does not need Web Components. It needs Web Components **plus** a state manager, a data-fetching layer, a server framework, an ORM, a serialisation format, a validation library, an API description layer, a mobile SDK, and some way to keep all of these consistent with each other as requirements evolve. Every boundary between those tools is a place where code must be written, bugs can hide, and developers must context-switch between different mental models and APIs.

FOAM's answer to this problem is not a better version of one of those tools. Its answer is to ask: *what if a single declaration — one description of what a class is — could be the source of truth for all of them?*

```
One model  →  JS class · Java class · Swift class
           →  Reactive UI form
           →  Persistence (DAO / journal / JDBC)
           →  Network marshaling
           →  Validation
           →  Serialisation
```

Web Components is an excellent solution to one part of this problem — defining reusable, interoperable custom elements. But it says nothing about persistence, the server tier, validation, or cross-platform code. When you compare FOAM to Web Components, you are comparing FOAM to a single spoke of a wheel that still needs many more spokes, a hub, and an axle.

With that caveat noted, the comparison below is still useful for understanding *how* the two systems approach the UI problem they share, and where the historical connection between them lies.

---

## Common Origins

Both FOAM and Web Components have roots in Google's engineering culture of the early 2010s, and the connection between them is closer than most developers realise.

**Web Components** — the suite of browser standards comprising Custom Elements, Shadow DOM, and HTML Templates — was championed primarily by Google engineers and first proposed around 2011. The goal was to bring component-based development directly into the browser platform so that developers could define reusable custom HTML elements with encapsulated behaviour and style, without needing a framework.

**Polymer**, Google's library built on top of those emerging standards, was announced in 2013. It polyfilled Web Component APIs across browsers and added a declarative property system, two-way data binding, and a component-definition API that deliberately resembled `foam.CLASS({...})`.

**FOAM** (Feature Oriented Active Modeller) was also developed at Google during this same period by Kevin Greer and the FOAM team. In its early iterations, Polymer was partially based on FOAM — borrowing ideas about declarative property definitions with type metadata, observers, and reactive change propagation. The conceptual kinship is unmistakable: compare Polymer 1.x's property declarations

```javascript
// Polymer 1.x
Polymer({
  is: 'my-element',
  properties: {
    name:  { type: String, observer: 'nameChanged', notify: true },
    count: { type: Number, value: 0 }
  }
});
```

with FOAM's property axiom system

```javascript
// FOAM
foam.CLASS({
  name: 'MyElement',
  properties: [
    { class: 'String', name: 'name', postSet: function(_, n) { this.nameChanged(n); } },
    { class: 'Int',    name: 'count' }
  ]
});
```

Both frameworks were wrestling with the same problem: how to bring rich, reactive, observable properties to web components through a single declarative description.

The two efforts then diverged in almost every important dimension: scope, implementation strategy, and ambition.

**Polymer was not the only Google project to do this.** Another team at Google building Lovefield — a relational query layer for web applications — encountered FOAM's DAO system and saw exactly what they needed. Lovefield 1.0 was essentially FOAM1 with everything except the bare models and DAO layer removed. Like Polymer, it extracted one part of FOAM and shipped it as an independent library.

The result of both extractions illustrates the point made at the top of this document. Given a Polymer + Lovefield application, a developer still has the UI component system and the data query layer — but still lacks reactive properties that work across tiers, serialisation, validation, server-side Java or Swift generation, REST marshaling, and the glue code connecting all of these to each other. Polymer and Lovefield together do not sum to FOAM; they sum to two of FOAM's sub-systems with all of the integration burden left to the application developer.

Two separate teams at the same company, working in the same engineering culture, independently looked at FOAM and extracted the one part relevant to their immediate mandate. Both produced useful libraries. Neither extracted the thing that makes FOAM valuable — the fact that a single model declaration is the source of truth for all of those sub-systems simultaneously, with no integration code required between them.

## Where the Paths Diverged

### Scope: One Problem vs. the Whole Stack

The Polymer/Web Components effort was deliberately scoped to one problem: *how do we get reusable custom elements into the browser platform?* That is a real and important problem, and Web Components solves it well.

FOAM was conceived as a more complete solution. The goal was never specifically a UI component system — the UI was one output of a model-driven framework whose primary concern was eliminating the overhead of building and maintaining an entire application across multiple languages, platforms, and tiers. Web components were part of the picture, not the picture.

### Two-Way Data Binding: A Persistent Struggle

One of the most telling technical divergences is in how the two systems handled two-way data binding.

Polymer committed early to two-way data binding as a core feature: changes in a child component would propagate up to its parent automatically. In practice, making this work correctly and efficiently against the DOM proved extremely difficult. The implementation was complex, had edge cases, and carried significant performance overhead. Rather than solve the underlying problem, Polymer progressively watered down its two-way binding — first making it opt-in per-property (`notify: true`), then requiring explicit binding syntax to distinguish directions (`{{two-way}}` vs `[[one-way]]`), and eventually, in Lit, abandoning the concept in favour of explicit events and callbacks.

FOAM did not have this problem. Rather than routing reactivity through the DOM (where the browser's attribute/property model creates friction), FOAM's reactive system lives entirely at the object level. A FOAM property produces a **slot** — a first-class reactive reference that can be subscribed, composed, mapped, and linked in any direction:

```javascript
// One-way: read the slot wherever you need it
this.add(this.data.name$);            // DOM node updates automatically

// Two-way: cleanly link two properties
this.nameField.data$.linkFrom(this.data.name$);

// Derived: compute from multiple dependencies
var label = this.slot(function(firstName, lastName) {
  return firstName + ' ' + lastName;
});
```

Because slots are plain JavaScript objects that wrap a getter/setter pair and a subscription list, two-way linking is a straightforward operation with no DOM involvement and no special syntax. The complexity that broke Polymer's binding system simply does not arise.

### Library vs. Browser Standard

Perhaps the most consequential strategic difference was the decision to pursue Web Components as a *browser standard* rather than a *library*.

Making something a browser standard sounds appealing: native performance, no library overhead, works forever. But browser standards carry serious costs:

- **Speed of iteration.** A library can ship a fix or a new feature in days. Getting a change into a W3C standard takes years — specification work, browser vendor agreement, implementation, and stabilisation all happen in slow sequence.
- **Implementation inconsistencies.** Every new browser API goes through a period where different browsers implement it differently, incompatibly, or incompletely. Libraries can ship polyfills immediately; standards must wait for vendors.
- **Backwards compatibility forever.** Once a behaviour is in the browser, removing or changing it is nearly impossible. A library can make a breaking change in a major version. This means browser standards accumulate legacy behaviour and edge cases that would be unacceptable in a well-maintained library.
- **Irreversibility.** If the design turns out to be wrong — and complex new standards often have design mistakes — a library can change course. A browser standard cannot.

FOAM's approach demonstrated that you could achieve the same goals — encapsulated, reusable components with reactive properties — using existing browser standards (the DOM, JavaScript classes, CSS) and a small library on top. The library approach is more agile, more fixable, and iteration happens at development speed rather than standards-committee speed.

This turned out to be exactly the trajectory that the Polymer team itself eventually took: Lit is essentially an acknowledgement that a small library over the existing platform is the right answer, and that the complex parts of Web Components (especially HTML Imports, which was abandoned entirely) did not need to be standards at all.

## Why FOAM Had to Write Its Own UI Library

The original intention was not to build a UI framework at all. The plan was to find a suitable third-party library and integrate it with FOAM's model system. That plan failed — not because the libraries were poor, but because every library that existed made an assumption that turned out to be incompatible with FOAM's design.

### RISC-y APIs

To understand why, consider the evolution of CPU instruction sets. (This principle is explored in depth in [RISCyAPIs.md](RISCyAPIs.md).)

Early computers were programmed mostly in assembly language, so CPU designers built **CISC** (Complex Instruction Set Computer) architectures: rich instruction sets with many addressing modes and high-level operations, because it mattered enormously how convenient they were for a human to write by hand. That convenience came at a cost — added complexity and lost performance.

When high-level languages became dominant and humans stopped writing assembly directly, CPU designers realised something important: the compiler, not the human, was now generating the instructions. A compiler does not care whether an instruction is convenient to type. It cares whether the instruction set is small, fast, and regular. This insight produced **RISC** (Reduced Instruction Set Computer) architectures — much smaller, faster instruction sets that were harder for humans to write in directly but ideal for compilers to generate.

FOAM's UI library is RISC-y in exactly this sense. It is not designed for a human sitting at an editor, hand-authoring each component. It is designed for FOAM — the "compiler" — to generate programmatically. Because humans are not the direct consumers, the API does not need to be convenient for humans; it needs to be small, fast, and composable. This is why the entire DOM view library is a few thousand lines and the Canvas view library a fraction of that. Existing UI libraries of that era were CISC-style: large, feature-rich, optimised for human ergonomics. They could not be the backend for a framework that generates UI, for the same reason a CISC instruction set is the wrong target for a modern optimising compiler.

FOAM's MLang DAO query API is another example of the same principle. Rather than a rich, human-readable query DSL, MLang is a small, composable set of predicate and expression objects that FOAM constructs programmatically. A human writing `M.AND(M.EQ(Invoice.STATUS, 'OPEN'), M.GT(Invoice.AMOUNT, 0))` is doing so through a thin API layer; the real consumer is the DAO decorator pipeline and the query optimiser, which operate on the predicate tree directly.

### What Existing Libraries Got Wrong

Every UI library of that era was built around the idea that **a human developer writes each component by hand**. The library's job was to make that handwriting pleasant and readable: nice template syntax, JSX, decorators, named component registrations. All of the ergonomic choices optimised for a developer sitting at an editor composing a component explicitly, one at a time.

FOAM's requirement was precisely the opposite. FOAM's model-driven approach means that the *framework generates views from property metadata* — automatically constructing forms, tables, detail views, and browse screens from a class description, without a human hand-authoring each one. For this to work, the UI library needs:

- **Programmatic construction.** Elements must be composable in code, not only in templates or JSX. A generic `DetailView` needs to iterate over a model's properties and add an appropriate field for each one, without knowing ahead of time which model it will receive.
- **Dynamic generation.** The set of properties, their types, their visibility conditions, and their views must all be resolvable at runtime from model metadata. Static type systems and template compilation work against this.
- **Composition as a first-class operation.** The library must make it as easy to compose views from code as from markup, so that the framework — not the developer — assembles the full UI from a model declaration.
- **Efficient point updates.** Because views are generated rather than hand-tuned, the runtime must update exactly the one DOM node that changed. Virtual DOM diffing is designed for hand-authored component trees; in a programmatically generated context it adds overhead without benefit.

FOAM's U2/U3 fluent builder API was designed specifically around these requirements:

```javascript
// A generic view that works for ANY FOAM model — no hand-authoring needed
function render() {
  var self = this;
  this.data.cls_.getAxiomsByClass(foam.core.Property).forEach(function(prop) {
    if ( prop.hidden ) return;
    self.start().add(prop.__).end();   // prop.__ = property + label + validation
  });
}
```

This reflection-driven pattern is how FOAM's `DetailView`, `TableView`, and `DAOBrowserView` work — they receive any model and produce a complete, correct, reactive UI with no per-model code. No existing library made this natural. FOAM had to build a UI system designed from first principles around programmatic generation rather than human authorship, and the result is a library that is smaller and faster than its CISC counterparts precisely because it is not burdened by human-ergonomics features it will never need.

## Core Philosophy

**Web Components / Lit** is fundamentally about *extending the browser platform*. You define custom HTML elements that become first-class citizens alongside `<div>` and `<input>`. The browser manages the lifecycle, the DOM owns the rendering, and Shadow DOM enforces style isolation. The ethos is standards-first, lean, interoperable — a Web Component works inside React, Vue, Angular, or no framework at all.

**FOAM** is fundamentally about *eliminating repetitive code through declaration*. You describe what a class *is* — its properties, methods, relationships, and constraints — and the framework generates all the machinery: getters, setters, validation, serialisation, persistence, UI, and reactive bindings. The UI layer (U2/U3) is one output among many. FOAM is equally concerned with the Java server class, the Swift client, and the network marshaling layer between them.

## Component Definition

### Bare Web Components

```javascript
class MyCard extends HTMLElement {
  static observedAttributes = ['title', 'author'];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback()                       { this._render(); }
  attributeChangedCallback(name, _, newVal) { this._render(); }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>h2 { color: steelblue; }</style>
      <h2>${this.getAttribute('title') ?? ''}</h2>
      <p>by ${this.getAttribute('author') ?? ''}</p>
    `;
  }
}
customElements.define('my-card', MyCard);
```

Without a library, Web Components require manual DOM manipulation, and any property change must be wired to a re-render by hand.

### Lit (modern Web Components)

```javascript
import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';

class MyCard extends LitElement {
  @property() title  = '';
  @property() author = '';

  static styles = css`h2 { color: steelblue; }`;

  render() {
    return html`
      <h2>${this.title}</h2>
      <p>by ${this.author}</p>
    `;
  }
}
customElements.define('my-card', MyCard);
```

Lit adds efficient property-driven re-rendering and tagged template literals for templates. This is the closest analogue to FOAM's U2 view system among standards-based libraries.

### FOAM

```javascript
foam.CLASS({
  name: 'MyCard',
  extends: 'foam.u2.View',
  properties: [
    { class: 'String', name: 'title'  },
    { class: 'String', name: 'author' }
  ],
  css: `
    ^ h2 { color: steelblue; }
  `,
  methods: [
    function render() {
      this.start('h2').add(this.title$).end()
         .start('p').add('by ').add(this.author$).end();
    }
  ]
});
```

`this.title$` is a live **slot**. Adding it to a DOM node creates a subscription — the node updates precisely in place whenever `title` changes. There is no virtual DOM to diff and no `render()` method to schedule. The FOAM class is also a full model with JSON serialisation, cross-language code generation, and DAO persistence at no extra cost.

## Reactivity

### Bare Web Components

No built-in reactivity. Changes must be wired manually:

```javascript
set title(v) { this._title = v; this._render(); }
get title()  { return this._title; }
```

### Lit

Uses `@property()` decorators. Lit schedules a re-render whenever a reactive property changes:

```javascript
@property({ type: String }) title = '';
// Lit re-renders the component on change — efficiently, but the whole component
```

### FOAM

Properties are first-class reactive objects. Every property automatically produces a **slot** that can be subscribed, mapped, derived, and linked in any direction — including two-way — without routing through the DOM:

```javascript
// Subscribe directly
this.title$.sub(function(_, __, ___, newVal) {
  console.log('title changed:', newVal);
});

// Derive a computed slot from multiple properties
var byline = this.slot(function(title, author) {
  return title + ' — ' + author;
});

// Two-way link — no special syntax, no DOM involvement
this.nameField.data$.linkFrom(this.data.name$);
```

The key difference from Polymer's troubled two-way binding is that FOAM's reactivity lives entirely at the object level, independent of the DOM. Slots are plain JavaScript objects; linking them does not require knowing anything about the DOM tree, the element hierarchy, or browser event propagation. This is why FOAM's two-way binding worked from the start while Polymer's repeatedly required the system to be redesigned.

## Style Encapsulation

| | Bare Web Components | Lit | FOAM |
|---|---|---|---|
| Mechanism | Shadow DOM | Shadow DOM | Generated scoped class names (`^`) |
| Browser-native | Yes | Yes | No |
| Global styles penetrate | No (blocked) | No (blocked) | Yes (by default) |
| CSS custom properties work | Yes | Yes | Yes |
| Inspectable in DevTools | Yes | Yes | Yes |

FOAM's `^` prefix expands to a component-unique class name at definition time. This is the same approach as CSS Modules or Vue's `scoped` attribute — styles are local without the isolation wall of Shadow DOM, so global typography and design tokens flow in naturally.

## Data Layer

**Web Components** has no data layer. Components receive data through HTML attributes, JavaScript properties, or whatever external state manager the application chooses.

**FOAM** ships a complete, uniform data access layer. The DAO interface abstracts over in-memory, file-backed, JDBC, and remote data sources with identical query semantics:

```javascript
var invoices = await this.invoiceDAO
  .where(M.AND(
    M.EQ(Invoice.STATUS, 'OPEN'),
    M.GT(Invoice.AMOUNT, 0)
  ))
  .orderBy(M.DESC(Invoice.DUE_DATE))
  .limit(20)
  .select();
```

A `ClientDAO` in the browser proxies transparently to a server-side `JDAO` or `JDBCDAO`. UI components never know where data lives.

## Cross-Platform Code Generation

**Web Components** targets the browser. The artefact is always HTML/CSS/JS.

**FOAM** generates production code for multiple platforms from one model:

| Output | Platform |
|---|---|
| Reactive JavaScript class | Browser + Node.js |
| Java class with getters, serialisation, validation | JVM server |
| Swift class | iOS/macOS |
| UI form | Browser (U2/U3) |
| Network marshaling protocol | Browser ↔ Server |
| DAO-storable entity | Any DAO backend |

A property added to a model is simultaneously a form field, a database column, a JSON key, and a Java getter — with no additional work.

## Framework Interoperability

**Web Components** wins here. Custom elements registered via `customElements.define()` work natively inside React, Angular, Vue, Svelte, or raw HTML — the most interoperable component format the web has.

**FOAM** is self-contained. FOAM views are not registered as browser custom elements, so they are not drop-in components in an external framework. A FOAM application can embed third-party custom elements freely, however:

```javascript
// Using an external custom element from inside a FOAM view
this.start('sl-button').attr('variant', 'primary').add('Save').end();
```

FOAM does have its own element registration system — but it operates at the FOAM level rather than the browser level. Any FOAM view can be registered as the handler for a given tag name within FOAM's rendering context:

```javascript
foam.__context__.registerElement(foam.core.reflow.ImageTag, 'img');
```

After this registration, any `this.start('img')` call inside a FOAM view creates an instance of `foam.core.reflow.ImageTag` rather than a plain `<img>` element. FOAM uses this internally in its REFLOW environment, for example, to replace the default `<img>` tag with an enhanced version that can load images from other blocks in the same FLOW document — adding features that a plain `<img>` cannot provide — while keeping all existing view code that writes `start('img')` unchanged.

This is analogous to what `customElements.define()` does for the browser, but scoped to FOAM's own rendering layer. It gives FOAM the same ability to transparently substitute behaviour behind familiar tag names, without touching the browser's element registry.

## Lifecycle Comparison

| Event | Bare Web Components | Lit | FOAM |
|---|---|---|---|
| Object created | `constructor()` | `constructor()` | `init()` |
| First render | `connectedCallback()` | `firstUpdated()` | `render()` |
| Removed from DOM | `disconnectedCallback()` | `disconnectedCallback()` | `onDetach()` subs fire |
| Property changed | `attributeChangedCallback()` | reactive `@property` | slot subscription |

FOAM's reactive slot graph drives updates precisely where needed — without lifecycle callbacks for "something changed, re-run render."

## When to Choose Web Components / Lit

- You need components that work inside multiple frameworks, or no framework at all
- You are building a design system consumed across an organisation regardless of stack
- Your application is genuinely small — a few components with no generic views, no serialisation, no REST client, no validation framework (see note below)
- You are extending the HTML vocabulary with genuinely new element semantics
- Standards compliance and long-term platform alignment are priorities

> **On payload size.** The instinct to reach for a framework-less approach to minimise download size deserves scrutiny. A framework-less application is not code-free — it still needs `DetailView`, `TableView`, controllers, serialisation, REST clients, and validation, all written by hand. Once an application reaches a modest size, the custom implementations of these cross-cutting concerns outweigh the cost of the framework that would have generated them. The FOAM implementation of Gmail was 100× smaller than the conventional version.
>
> There is a useful analogy from economics. Whether you process a raw resource near its source or near its consumer depends on whether processing *shrinks* or *expands* the material. Trees shrink dramatically when milled into lumber, so sawmills are built in or near forests. Crude oil expands significantly when refined into its end products, so refineries are built on the outskirts of cities, close to consumers — not at the wellhead.
>
> FOAM models are crude oil. A compact model declaration expands by roughly 50× when FOAM generates getters, setters, validation, serialisation, UI, reactive bindings, and storage adapters from it at runtime. The economical approach is therefore to ship the small model and perform the expansion in the browser, where the result is consumed — exactly what FOAM does. The alternative — running server-side transpilers and bundlers that expand code before it is shipped — is the equivalent of refining oil at the wellhead and then transporting the expanded volume to consumers. It is precisely backwards.
>
> If your application is too small to recoup the framework's fixed cost, payload size was probably not a constraint in the first place.

## When to Choose FOAM

- You are building a full-stack application where the UI is one tier among many
- You need Java or Swift code generated from the same model as the UI
- You want reactive properties, persistence, network marshaling, and generated UI from a single declaration
- You are building internal enterprise tools, dashboards, or data-intensive applications
- You want the framework to generate forms and views from model metadata rather than hand-authoring each one

## Summary

FOAM and Web Components share common origins — both grew from Google's early thinking about declarative, reactive, component-based web development, and Polymer's property system drew directly from FOAM's ideas. But they diverged on almost every consequential decision: scope, binding architecture, and the library-vs-standard question.

Polymer's two-way data binding repeatedly had to be simplified because routing reactivity through the DOM is fundamentally difficult. FOAM's slot system, which lives entirely at the object level, avoided this problem entirely. Polymer bet on browser standardisation; FOAM demonstrated that a library over existing standards is more agile, more fixable, and gets to the same destination faster. Polymer focused on the component problem; FOAM aimed at the whole application.

And when the time came to choose a UI library to pair with FOAM's model system, none of the available options worked — because every existing library was built around a human writing each component by hand. FOAM needed a library designed for *programmatic generation*: a framework that could introspect a model and produce a correct, reactive, fully-featured UI without per-model code. That meant building U2/U3 from scratch.

The deepest point is this: the question "FOAM vs Web Components?" is the wrong question. The right question is "FOAM vs the entire ecosystem of tools I would otherwise need to wire together." Web Components, a state manager, an API client, an ORM, a server framework, and a mobile SDK are each individually fine. The cost is not in any one of them — it is in the seams between all of them. FOAM's proposition is to eliminate those seams by making one model the source of truth for every tier.
