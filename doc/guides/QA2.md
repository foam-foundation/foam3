<flow name="QA2" category="DOC/GUIDE" spid="foam" description="How the foam.QA2 decision-matrix questionnaire engine works and where it surprises: AQL predicates, answered means stored, how the next question is chosen, custom question views, and what the generated class looks like." keywords="qa2,questionnaire,decision matrix,wizard,predicate,aql,QAWizardView,QuestionChoiceView,information gain,knowledge"/>

# QA2: the decision-matrix questionnaire engine

`foam.QA2({...})` turns a table of questions and outcomes into a FOAM class that can pick the next question to ask and narrow down which outcome applies. `foam.u2.qa.QAWizardView` drives it on screen. The engine is `src/foam/u2/qa/QA.js`; a runnable example is `src/foam/u2/qa/demo.md`.

A definition has three lists:

- `properties:` typed inputs the system already knows, and output fields.
- `questions:` prompts for the user. A question with no `choices` and no `class` gets Yes/No, stored as the strings `'TRUE'` and `'FALSE'` (`QA.js:161-172`).
- `outcomes:` rows, each with a `predicate` string.

---

## Predicates are AQL, not MLang

Outcome and question `predicate` strings are compiled at runtime by `foam.parse.SimpleQueryParser` (`QA.js:277-292`), the same grammar as the search box. So the syntax is the search syntax:

- `field = value`, `!=`, `>`, `>=`, `<`, `<=`, `IN (...)`, `NOT IN (...)`, `CONTAINS`, `IS EMPTY`, `IS NOT EMPTY`, joined with `AND`, `OR`, `NOT` and parentheses.
- **A `Boolean` property accepts only `IS TRUE` and `IS FALSE`** (`src/foam/parse/SimpleQueryParser.js:214-215`, `:366`). `paid = TRUE` does not parse.
- A Yes/No **question** is a `String` holding `'TRUE'` or `'FALSE'`, so `spicy = TRUE` is an ordinary string comparison and is correct. Check the property's class before "fixing" one form into the other; the demo uses both (`allergicToSeafood IS FALSE AND ... spicy=FALSE`).
- There are no function calls. To compare "days since a date", add a derived property that computes the number and compare that property.

**A predicate the parser cannot read fails late.** `parseString` returns `undefined`, and the compile step then reads `.arg1` off it (`QA.js:281-289`), throwing `Cannot read properties of undefined (reading 'arg1')` the first time the wizard evaluates that outcome, not when the class is defined. Open the wizard once after editing predicates.

---

## "Answered" means a value was stored

A predicate term only rules an outcome out once the property it names is answered. Answered is decided by `isAnswered_(name)` (`QA.js:343-359`), and it means **a value was stored**, never "the value looks truthy". A Boolean answered `false`, an Int answered `0`, and a choice whose value is `'0'` all count.

Three storage shapes get three tests, all explained in the docstring above `isAnswered_`:

| Property shape | Answered when |
|---|---|
| plain value | `hasOwnProperty(name)` is true |
| `factory`-backed (arrays) | the value is non-empty; reading it runs the factory, so `hasOwnProperty` would lie |
| `expression`-backed | the computed value is not `undefined`, `null` or `''` |

**An input that can be "unknown" should be a `String` with `''`, not a `Boolean` expression returning `null`.** `foam.lang.Boolean`'s adapt is `!!v` (`src/foam/lang/Boolean.js:28`), so any write of `null` (`copyFrom({ flag: null })`, a JSON row with `"flag": null`, a journal replay) stores `false`, and "unknown" silently becomes "answered no". Only an unset default or an expression can stay `null`.

**Seeding.** Set only the inputs you actually know when creating the object. An input left unset keeps every outcome that mentions it alive, which is what lets the questions ask about it.

---

## How the next question is chosen

`selectNextQuestion()` (`QA.js:390-464`):

1. Stops when one candidate or none is left.
2. Skips answered questions, and questions whose own `predicate` is already contradicted by stored answers.
3. Scores the rest by information gain: how evenly each choice would split the remaining outcomes (`computeInfoGain`, `QA.js:475-547`).
4. Picks the lowest `priority` number first, then the highest gain, then fewer choices. The default is `100`, and because the engine reads `q.priority || 100` (`QA.js:414`), a priority of `0` also becomes `100`; start at `1`.
5. **Returns the property axiom**, not the question object, or `null` when the best gain is `0` (`QA.js:463`). The axiom has no `choices`; a test that needs the choice list reads the `QUESTIONS` constant by name.

**A question's `predicate` is "not ruled out", not "gate satisfied".** The filter that would require it to be true is commented out (`QA.js:436`, `/*q.enabled &&*/`). A question gated on `cuisine = Asian` can still be asked while `cuisine` is unanswered; it is only excluded once `cuisine` is answered with something else. When a gated question still has gain but its predicate is not yet true, the engine promotes the questions its predicate names: they take the higher gain and a priority one below it (`QA.js:423-434`), so they are asked first. Set a `priority` by hand only when the gate names an input property rather than a question, since an input is never asked.

**A question with a `class:` and no `choices` gets an estimated gain.** The engine cannot split outcomes per choice, so the score is `0.001` per remaining outcome that names the question (`QA.js:503`) plus a rough estimate from outcomes that do not name it. A question that scores `0` is never asked. Give such questions an explicit `priority`.

---

## Custom question views

The generated property for a question gets `foam.u2.qa.QuestionChoiceView` only when the question declares no `class:` (`QA.js:204-212`). So:

- **`class:` is the switch.** Declare `class: 'String'` (or another type) and a `view:` spec to render your own view.
- **Put choices in the `view:` spec, not beside `class:`.** A question with both `class` and `choices` logs `[QACompiler] ... choices are ignored` and renders without them (`QA.js:198-202`).
- **Extend `foam.u2.qa.QuestionChoiceView`**, not `foam.u2.View`. Its `data` postSet calls `wizard.next()` (`src/foam/u2/qa/QuestionChoiceView.js:22-27`); a plain view never advances the wizard. Override `render()` only.
- `foam.u2.view.RadioView` reads `c[0]` as the value and `c[1]` as the label (`src/foam/u2/view/RadioView.js:96-125`). A third element such as helper text is ignored, so a two-line choice needs its own row rendering.
- A question named the same as a declared property keeps the property and drops the question's view and choices, with a warning (`QA.js:215-218`).

---

## The generated class

- **It has no shared base class.** `buildClass_` emits a plain class with no `extends` (`QA.js:240-243`). A property that must hold either of two questionnaires is `FObjectProperty` with `of: 'foam.lang.FObject'`; a narrower `of` makes the adapt rebuild the other class as the wrong type.
- **Every extra key on an outcome becomes a `String` property** (`QA.js:222-231`) and is copied onto the object by `applyOutcome`. Put a gating value, such as `priceBand: 'LOW'`, on each outcome as a plain field, and code can list "which outcomes exist for X" by filtering the `OUTCOMES` constant instead of parsing predicate strings.
- **`QUESTIONS`, `OUTCOMES`, `INPUT_NAMES` and `OUTPUT_NAMES` are JavaScript-only constants** (`flags: ['js']`, `QA.js:251-256`). Server code cannot read them.
- Like any model, the class must be registered in a `pom.js` with the `java` flag if a persisted object stores it in a property, or journal replay on the server cannot build it.
