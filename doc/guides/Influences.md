<flow name="Influences" category="DOC/GUIDE" spid="foam" description="Where FOAM's ideas came from: UNIX, Smalltalk, Lisp and Jini, and what FOAM does differently with each." keywords="history,philosophy,unix,smalltalk,lisp,jini,kaos,nano-services,mlang"/>

# Influences

This guide is about history and philosophy. It won't teach you how to write FOAM code; the
other guides do that. It explains where FOAM's ideas came from, so that the design reads as a
set of deliberate choices and not an accident.

In short, FOAM is:

- **UNIX** for separation of concerns: one universal interface, many small composable parts.
- **Smalltalk** for object orientation: everything is an object and the system reflects on itself.
- **Lisp** for meta-programming: code is data, and programs transform programs.
- **Jini** for distribution: the service registry also ships the client.

FOAM goes further than each of them, for reasons described below.

---

## 1. KAOS

FOAM and FOAM CORE began as KAOS, "Kevin's Amazing Operating System". The name was a joke,
chosen at eighteen, but the question behind it was serious:

> What would UNIX look like if you designed it around DAOs and objects instead of files and
> commands?

FOAM's resemblance to UNIX comes from that question. CORE is the operating system part of
the answer, and FOAM's modelling is what replaces bytes and lines with typed objects.

---

## 2. UNIX: One Interface, Used Well

UNIX is object-oriented in one important sense: it has polymorphism. A file, a pipe, a
terminal, a socket and a device all answer to `open`, `read`, `write` and `close`, so `cat`,
`grep` and `sort` work on all of them without knowing which they have. UNIX had only one
interface, but it used that interface very well.

CORE keeps that shape and replaces the parts:

| UNIX | FOAM CORE |
|---|---|
| file | DAO |
| line | object |
| `grep` | `where(predicate)` |
| `sort` | `orderBy(comparator)` |
| `more`, `head`, `tail` | `skip` / `limit` |
| `wc -l` | `select(COUNT())` |
| pipe | sink, and DAO decorators |
| `ioctl` | `cmd()` |
| shell scripts | `scriptDAO` (`src/foam/core/script/services.jrl:3`) |
| `cron` | `cronJobDAO` and `cronScheduler` (`src/foam/core/cron/services.jrl:29,78`) |
| `/etc/passwd`, `/etc/group` | `userDAO`, `groupDAO` (`src/foam/core/auth/services.jrl:434,191`) |
| file permissions | permissions checked by the DAO, on every operation |
| `init` / `systemd` units | CSpecs, with `start` / `stop` / `reload` on `COREService` (`src/foam/core/COREService.js:13-28`) |
| the kernel | `Boot`, which knows only `cSpecDAO` (see [CORE](CORE.md)) |
| `man` pages | models |

The last row matters most. A man page is prose for a person. A model is data that the whole
system can use: it drives the detail view, the table view, JSON and CSV output, validation,
storage, the Java and JavaScript classes, and the tool descriptions an LLM receives. UNIX
documents its interfaces. FOAM runs on its descriptions.

Some parts of CORE have no UNIX counterpart at all. The rule engine reacts to any change in
any DAO, and the generic `DAOController` gives a search, browse, create and edit screen for
any DAO. UNIX would need a separate program for each file format to do either.

### Why application servers exist

Operating systems stopped growing at files, processes and users. Business applications
needed typed records, queries, per-record authorization, change notification, audit history
and generated user interfaces, and no operating system supplied them. Application servers
and frameworks were invented to fill that gap. CORE is an attempt to show what an operating
system might have grown into if it had kept going: the same small kernel and composable
services, built for objects instead of bytes.

---

## 3. Smalltalk: Objects All the Way Down

Smalltalk showed that a whole system could be made of objects that reflect on themselves.
FOAM inherits that: objects keep a link to their class at runtime (`obj.cls_`), and the model
of a model is itself a model (`Model.cls_ === Model`).

FOAM differs from Smalltalk in three ways.

- **A richer meta-model.** A Smalltalk class has instance variables and methods. A FOAM class
  is a set of axioms: properties with types, defaults, validation, visibility, permissions and
  views; actions; listeners; relationships; and any new axiom a developer adds. Smalltalk's
  meta-model could be extended too, but in practice that wasn't done much.
- **Objects for storage, not only for computation.** Smalltalk kept objects in an image,
  which is a weaker store than a filesystem or a database. It didn't use objects to build an
  object-oriented filesystem or database. FOAM's composable, replaceable DAOs are exactly that.
- **Business applications from the start.** Smalltalk was not made suitable for
  database-backed business applications until it was too late to matter. FOAM was aimed at
  that work from the beginning.

UNIX had one interface and Smalltalk had any number. UNIX's single interface made `cat`,
`grep` and pipes work on everything, and Smalltalk never achieved composition at that scale.
FOAM takes both: Smalltalk's objects, used through a small number of strong canonical
interfaces such as `DAO`, `Sink`, `Predicate` and `View`, the way UNIX used the file.

---

## 4. Lisp: Code as Data

### mlang

One of Lisp's founding examples was a program that took an ordinary mathematical function,
treated it as a data structure, and produced its derivative. The insight was that a formula
can be something you transform, not only something you run.

mlang applies the same idea to queries. If a derivative can be computed from the structure of
a function, then SQL can be generated from the structure of a predicate. So an mlang
predicate is not a closure but a tree: `GT(Person.AGE, 18)` is the s-expression `(> age 18)`,
built from typed objects instead of cons cells. mlang is Lisp in disguise.

One tree supports many interpretations. `src/foam/mlang/predicate/Predicate.js` declares:

| Method | What it does with the tree |
|---|---|
| `f(obj)` | evaluates it against an object |
| `partialEval()` | simplifies it algebraically |
| `toDisjunctiveNormalForm()` | rewrites it into a canonical form |
| `toIndex(tail)` | works out which index can answer it |

`createStatement` and `prepareStatement` in `AbstractPredicate.js` translate the same tree into
SQL. `partialEval` is the closest relative of the derivative program: a symbolic derivative
produces expressions such as `0 * x + 1 * 1` and needs a simplifier, and a predicate
assembled from user filters, permissions and tenant scoping produces `AND(TRUE, AND(x, TRUE))`
for the same reason.

FOAM adds one thing that Lisp code-as-data didn't have. Because mlang trees are FObjects, they
serialise to JSON. A predicate can be built in a browser, sent to a server, simplified there,
and turned into SQL by a JDBC DAO or answered from an in-memory index. That is why code using
a DAO doesn't need to know what is underneath it. Smalltalk's predicates were blocks: they
could be run, but not inspected, so they could never become SQL.

### Macros versus models

Lisp's main meta-programming tool is the macro, and a macro expands where it is used. A
`defproperty` macro could generate a getter and a setter in place. It could not also update the
constructor, `equals`, `hashCode` and `toString`, the JSON parser and outputter, the database
mapping, or the detail view, because those live elsewhere. Once expanded, the declaration is
gone, and anything that later needs to know about the property must rediscover it.

FOAM works the other way round. A `Property` axiom is never expanded away; it stays on the
class as data, and each consumer comes to the model and asks. The Java generator, the JSON
outputter, the table view, the validator and the permission check each reflect over the same
declaration. So a new consumer, such as an XML exporter, works for every existing model without
any change to them. A macro has to know every output it is responsible for when it is written.

CLOS's Metaobject Protocol came closest to this in the Lisp world, with user-defined slot
classes that generic functions can examine at runtime. But it works within one language and
one image.

### Many tiers, many languages

Most systems now span several tiers and languages. The same entity is often described three to
five times: a database schema, a server class, a transfer object, an API schema, a client type
and a form. A single-language macro system can't keep those in step. FOAM puts the meta-level
above the languages, so Java, JavaScript and the other targets become outputs of one
declaration. This works only because the model is itself modelled: the reflection that draws a
detail view for an `Invoice` also drives the generator that writes `Invoice.java`.

The cost is that FOAM must maintain a generator per target language and keep each one
consistent with the meta-model, where Lisp got its meta-programming free from the reader and
`eval`. But FOAM pays that cost once, in the framework, instead of every application paying it.

---

## 5. Jini: Ship the Client with the Service

Jini, from Sun Microsystems, kept a service's client code in the service registry, so
discovering a service also gave you the code needed to talk to it. Jini never took off, but
the idea is a powerful one, and CSpecs adopt it. A CSpec describes both the server
implementation and, in its `client` property, the client that talks to it. The `ClientBuilder`
reads the CSpecs and builds the client from them (see [CORE](CORE.md) and
[agentsnotprotocols.md](agentsnotprotocols.md)).

Shipping the client means shipping its policy as well. A CSpec's client can include a cache
and a sync strategy, so a service that looks remote makes no network calls at all once its
data has arrived, apart from updates. `menuDAO` is the familiar example: the client caches it in
full. The caller's code is the same either way.

This is also why FOAM avoids designing explicit REST endpoints. An endpoint makes the
programmer think about URLs, verbs, status codes and serialisation, none of which is their
actual problem. Services and stores should be objects; transport is configuration.

---

## 6. Nano-services

CORE services are sometimes called nano-services, because they are lighter than
microservices.

Microservices bundle two separate things: **modularity** (an isolated service with a clean
interface) and **distribution** (that service running in its own process, behind a network).
Most of their benefit comes from the first, and most of their cost from the second. CORE keeps
the isolation and drops the network until it's needed. Services are looked up by name from the
context, each behind its own interface. When a service really must live elsewhere, a
`ClientDAO` or another client on the server mounts it from another server, and the code using it
doesn't change. Such cases are rare.

The common reason for adopting microservices is that most developers keep to proper interface
design and isolation only when the platform forces them to. That enforcement is real, but it is
expensive to get it from network boundaries. A few architectural guidelines, applied within one
process, achieve the same isolation far more cheaply.

Scale makes the difference obvious. Production FOAM applications have run with 700 to 1,000
services, a number that would be very hard to manage as conventional microservices.

### Most services are DAOs

In a server with 700 services, probably more than 500 are DAOs. Having one interface for
all of them instead of 500 similar ones has several effects:

- **Developers** learn one interface, not 500.
- **Decorators and views** become possible: caching, authorization, auditing, history,
  journalling and rules are written once as DAO decorators and apply to every DAO; table, detail
  and search views work on any DAO.
- **Authorization** is written once. Developers don't have to get their own auth code right 500
  times.
- **Applications get smaller**, which matters most for clients that have to be downloaded.
- **LLMs** need a handful of generic tools instead of one tool per service. Describing more than
  500 service-specific tools in tokens would make an MCP server too expensive for applications
  of this size. FOAM's MCP agent offers generic DAO tools instead (`src/foam/core/ai/mcp/MCPWebAgent.java:87-135`).

> The DAO isn't the perfect interface for anything, but it is the perfect interface for
> everything.

That is UNIX's lesson about the file, applied to typed objects.

---

## 7. Only More So

Each of these systems got one part right on its own:

- **Lisp:** code as data.
- **UNIX:** one universal interface.
- **Smalltalk:** a system made of objects.
- **Jini:** the registry ships the client.

FOAM depends on all four together, and goes further with each:

- **Beyond UNIX:** the universal interface carries types and queries, not bytes and lines.
- **Beyond Smalltalk:** the meta-model is richer, and models are queryable, storable data,
  not only reflective objects.
- **Beyond Lisp:** meta-programming is not local and works across languages, because
  declarations persist as data instead of being expanded away.
- **Beyond Jini:** the client that ships with the service carries its caching and sync policy,
  and the user's permissions decide which services are sent at all.
