# FOAM and LLMs

The features that code enables are valuable assets. The code itself is a liability.

This distinction matters more than ever in the age of LLM-assisted development. Every line of code — regardless of who or what wrote it — carries a long tail of obligations: testing, maintenance, migration, bug fixes, documentation, and the cognitive burden placed on everyone who must understand it. Code is not free. Code is debt.

## The Mansion Problem

Traditional code generation tools promised liberation from tedious implementation work. And they delivered — spectacularly, at first. Organisations could generate millions of lines of code in hours rather than months. Early results looked like triumph.

But code generators are also liability generators.

Consider winning a mansion in a lottery. You suddenly own a home far beyond your means, obtained for free. Wonderful — until you receive the property tax bill, the utility costs, the roof repair estimate, the grounds maintenance invoice. The mansion was free to acquire but ruinous to own. Many lottery winners end up selling or losing these "prizes" because the carrying costs exceed their capacity to pay.

The same pattern has played out repeatedly with code generation. The initial velocity is intoxicating. The eventual maintenance burden is crushing. Projects that seemed to be racing ahead find themselves drowning in generated code that nobody fully understands, that breaks in unexpected ways, that resists modification because its logic is scattered across thousands of auto-generated files. The liability eventually overwhelms the asset.

## History Repeating with LLMs

We are now watching this pattern repeat with LLM-generated code, but at an even more dangerous scale.

LLMs can produce vast quantities of plausible-looking code with unprecedented speed. Features ship quickly. Demos impress. The metrics look favourable.

But the liability is accumulating silently.

LLM-generated code carries all the traditional maintenance burdens plus new risks: subtle logical errors from hallucination, inconsistent patterns across generation sessions, solutions that work but don't align with the codebase's architectural conventions. Each generated function is another item requiring review, testing, documentation, and eventual maintenance by humans who didn't write it and may not fully grasp its intent.

We have seen applications where a single login screen is larger than an entire FOAM application that includes over 400 DAOs, 625 microservices, and hundreds of menus. When bundle sizes become prohibitive, teams switch to server-side rendering as a remedy — trading one set of problems for another — rather than addressing the underlying cause: too much code was generated and retained in the first place.

The mansion is getting larger. The carrying costs are compounding.

## FOAM's Different Approach

FOAM addressed this liability problem not by generating more code, but by elevating the level of discourse.

Traditional code generation takes a high-level specification and expands it into low-level procedural implementation. One line of specification might become fifty lines of code. The liability multiplies. FOAM inverts this relationship.

Compare the two approaches directly:

```javascript
// Traditional JavaScript — verbose, every line a liability
class Person {
  constructor() {
    this._firstName = '';
    this._lastName  = '';
    this._listeners = [];
  }
  get firstName() { return this._firstName; }
  set firstName(value) {
    if ( typeof value !== 'string' ) throw new Error('Invalid type');
    const old = this._firstName;
    this._firstName = value;
    this._notifyListeners('firstName', old, value);
  }
  // ... repeated for every property
  // ... implement listener pattern
  // ... implement validation
  // ... implement serialisation
}
```

```javascript
// FOAM — pure intent, framework provides everything else
foam.CLASS({
  name: 'Person',
  properties: [
    { class: 'String', name: 'firstName' },
    { class: 'String', name: 'lastName' },
    { class: 'Int',    name: 'age' }
  ]
});
```

Instead of generating verbose implementations, FOAM lets developers — and LLMs — express intent directly as high-level declarative models. The framework provides the implementation through reusable Features that encode best practices, patterns, and behaviours. Less code. Less liability. Same functionality.

## Why FOAM's Structure Works for LLMs

Several properties of FOAM's design align directly with how LLMs work best.

**High signal-to-noise ratio.** FOAM code is semantic metadata, not mechanical procedure. Every token carries intent. LLMs excel at understanding and generating high-level descriptions; they struggle with boilerplate and framework-specific incantations. FOAM keeps LLMs in their zone of strength.

**Consistent, predictable structure.** Every FOAM class follows the same shape — `package`, `name`, `extends`, `properties`, `methods`, `actions`, `listeners` — in the same order. There is typically one FOAM way to express something, not dozens of valid variations. LLMs produce better output against a small, regular target than against a large, irregular one. This is the same principle as [RISC-y APIs](RISCyAPIs.md): a small instruction set designed for a compiler (or an LLM) beats a large one designed for human convenience.

**Natural language alignment.** FOAM declarations map directly to how humans describe systems. The gap between intent and code is narrow:

> *"I need a User with email, password, and a way to check if they're an admin."*

```javascript
foam.CLASS({
  name: 'User',
  properties: [
    { class: 'EMail',    name: 'email',    required: true },
    { class: 'Password', name: 'password', required: true },
    { class: 'Enum',     name: 'role',     of: 'UserRole' }
  ],
  methods: [
    function isAdmin() { return this.role === UserRole.ADMIN; }
  ]
});
```

The LLM does not generate getters, setters, change notification, serialisation, validation wiring, or UI code — FOAM generates all of that from the declaration. The LLM's output surface area is small and correct by construction.

**Less surface area for hallucination.** When an LLM generates a thousand lines of procedural implementation, subtle errors — a missed edge case, an off-by-one, a wrong algorithm — hide in the volume. When it generates fifty lines of declarative model, there is far less room for hallucination-induced bugs. The framework's implementation is shared, tested, and not regenerated each time.

## The Compounding Advantage

The benefits compound in ways that are not immediately obvious.

When best practices evolve, traditional generated code must be regenerated or manually updated across the entire codebase. Every file touched is another opportunity for bugs, another merge conflict, another round of testing. The liability of change scales with the volume of code.

With FOAM, updating a Feature updates behaviour everywhere that Feature is used. The high-level model declarations remain stable. One change, applied universally, tested once. The liability of change is contained.

When languages or libraries change, traditional codebases face migration projects proportional to their size. FOAM models, being declarative specifications rather than procedural implementations, largely transcend these shifts. The framework adapts; the models persist.

As your library of FOAM Features grows, new functionality increasingly comes from combining existing, tested, maintained components rather than generating new code. Each new Feature — whether written by a developer or generated by an LLM — becomes leverage for future development. Capability grows combinatorially while liability grows sublinearly.

## Conclusion

The question facing organisations adopting LLM-assisted development is not whether AI can generate code quickly. It obviously can. The question is whether the generated code creates assets that exceed the liabilities incurred.

For traditional code generation, history suggests the answer is often no. The mansion eventually bankrupts its owner.

FOAM offers a different answer. By elevating development to high-level declarative models, by encoding implementation patterns in reusable Features, by minimising the code surface area that must be maintained, FOAM changes the fundamental calculus.

When using LLMs to generate code, the sustainable approach is not to maximise output volume. It is to maximise the ratio of capability to liability. Generate high-level FOAM models. Create reusable FOAM Features. Let the framework carry the implementation burden.

Less code. Less liability. More leverage. Better outcomes.

The mansion is lovely, but what if you could have all its features — every room, every amenity — in a structure that costs a fraction to maintain? That is what FOAM offers: mansion functionality with cottage upkeep.
