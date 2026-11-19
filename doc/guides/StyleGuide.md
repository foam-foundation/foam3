<flow name="StyleGuide" category="DOC/GUIDE" spid="foam" description="FOAM coding style guidelines: Google JS Style Guide exceptions, naming conventions, and modelling over prototyping." keywords="style guide,naming conventions,formatting,knowledge"/>

# FOAM3 Coding Style Guidelines

Except where noted below, FOAM conforms to the [Google Javascript Style Guide](https://google.github.io/styleguide/jsguide.html).
Java code should abide by the [Doug Lea Java Code Standard](http://gee.cs.oswego.edu/dl/html/javaCodingStd.html)

## Exceptions
* One space is required inside the parentheses of `if`, `for`, `while`, and `switch` headers:
```javascript
if ( a < b ) ...
for ( var i = 0 ; i < words.length ; i++ ) ...
for ( var key in obj ) ...
while ( true ) ...
switch ( argCount ) ...
```
* The `!` operator must be followed by a space.
```javascript
if ( ! found ) ...
```
* One-statement `if`, `while`, and `for` statements that can fit on a single line (less than 80 characters) do not need braces:
```javascript
if ( ! found ) return false;

for ( var i = 0 ; i < a.length ; i++ ) a[i] = '';
```
* The rules about using Closure's `goog.provide`, `goog.require` and similar are
  omitted; use FOAM's `requires: []` support instead.
* The rules about using JSDoc comments to inform the Closure compiler's
  type-checking are omitted; use FOAM's type-checking instead.
* Encourage the use of vertical alignment where it makes sense, since it makes code easier to read. Ex.:
```javascript
  var firstName = 'John';
  var lastName  = 'Smith';
  var age       = 42;
```
* The Google standard uses two space for indentation but four spaces for line continuation. This is conflicting for FOAM since the U2 library is an internal DSL for creating virtual DOM and it relies on long heirarchical continued statements. While this is technically a continued statement, and should therefore use four spaces, the indent is clearly one of structural indentation, which would require two. To avoid the conflict FOAM uses two spaces of indentation in both case. Ex.:
```javascript
      this
        .addClass(this.myClass())
        .start()
          .start('p')
            .addClass('label')
            .add(this.data)
            .startContext({ data: this })
              .add(this.REMOVE_SELF)
            .endContext()
          .end()
        .end();
```

* `catch` keeps the plain Java form, with no spaces inside the parentheses: `} catch (Throwable t) {`.
* No `else` after a `return`: write `if ( a ) return 1; return 2;`.

## Naming

* Model names should be capitalized CamelCase. Ex. `Model`, `Photo`, `EMail`.
* Acronyms should have all letters capitalized: Ex. `DAO`
* Properties should start with a lower-case character and be camelCase. Ex. `parent`, `firstName`
* Non-public properties and methods can end with an underscore (`_`). Ex. `listeners_`
* Use `NAMES_LIKE_THIS` for constant and message names.
* A refinement's file and name end in `Refinement`. Ex. `GroupPermissionJunctionRefinement`
* A file is named after the model it defines. Ex. `MetricOperation.js` defines `MetricOperation`
* A mixin is not named `Utils`; name what it adds. Ex. `foam.u2.memento.Memorable`
* Rule ids are package-qualified, so two packages' rules cannot collide. Ex. `foam_core_referral_BuildReferralCodeURL`

## Modelling
Code should be modeled rather than created as conventional JS prototypes.

Provide property labels when the default labelization of the property name will not be helpful or attractive to users.

Write the axioms of a `foam.CLASS` in this order: `package`, `name`, a blank line, `extends` /
`implements` / `mixins` / `refines`, `requires`, `imports`, `exports`, `javaImports`,
`documentation`, `tableColumns` / `searchColumns`, `sections`, `constants`, `messages`, `css`,
`properties`, `methods`, `listeners`, `actions`.

Do not restate a default. Each of these says something the framework already says:
* `start('div')`: `start()` creates a `div`, the default `nodeName` (`Element2.js:634-641`).
* `addClass(this.myClass())`: `addClass()` with no argument adds `myClass()` (`Element2.js:1167-1168`).
* `implements: ['foam.mlang.Expressions']` on a view: every `foam.u2.Element` already implements it (`Element2.js:485-487`).
* `after: false` on a rule or `async: false` on a method: both default to false.
* `{ name: 'data' }` for a property that sets nothing else: write `'data'`.

## Line Length
Line lengths should be 80 characters or less, except for embedded data, like templates or sprites, or when modifying the code to make it fit in less than 80 characters would actually makes it less readable.

## Calling DAO's From Java
When implementing DAO strategies in Java, implement the Context-Oriented (CO) methods, ie. those ending with _ and explicitly taking Contexts as the first paramter, like:
```java
   find_(X x, Object query).
```

When implementing DAO decoratores in Java, implement the CO methods and also delegate to the CO method of your delegate. ie.
```java
   getDelegate().find_(x, id).
```

When using a DAO as a regular client from outside of a decorator for that DAO, use the non-CO methods and use inX() to specify the context. ie.
```java
   DAO userDAO = ((DAO) x.get("userDAO")).inX(x);
   userDAO.find(id);
```

## Other
 * Use single quotes; use a template literal only to interpolate.
 * Sort the entries of `requires`, `imports`, `exports`, `javaImports` and a pom's file lists
   alphabetically, so a merge adds a line instead of conflicting.
 * Put formatting changes in their own commit, never mixed with a behaviour change, so the
   behaviour diff stays readable.
 * Do not quote map keys unless necessary.
 * Do not leave trailing unnecessary commas (this is implicit in the Google
   style guide).

## Comments
