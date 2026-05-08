# FOAM Sinks

FOAM Sinks are the destination objects that receive and process data from DAO (Data Access Object) queries. They implement a streaming architecture where data flows from a source DAO through the `select()` operation to a Sink that accumulates, transforms, or processes the results [1](#0-0) .

## The Sink Interface

The core `Sink` interface defines four methods for handling data streams [2](#0-1) :

```javascript
interface Sink {
  void put(obj, sub)     // Called for each object
  void remove(obj, sub)  // Called for removed objects (listen() only)
  void eof()             // Called when stream ends normally
  void reset(sub)        // Called when result set may have changed (listen() only)
}
```

The `sub` parameter is a `Detachable` subscription that lets sinks stop receiving data by calling `sub.detach()` [3](#0-2) .

## Source-to-Sink Architecture

FOAM's query system follows a "source-to-sink" pattern where:
- **Source**: The DAO containing the data you're querying
- **Sink**: The destination that receives/accumulates results
- **Flow**: `select()` streams objects from DAO to Sink [4](#0-3)

This is analogous to Unix pipes, where data flows through processing stages to an output destination [5](#0-4) .

## Common Built-in Sinks

| Sink | Purpose | Result Property |
|------|---------|-----------------|
| `ArraySink` | Collects all objects into an array | `.array` |
| `COUNT()` | Counts matching objects | `.value` |
| `SUM(prop)` | Sums a numeric property | `.value` |
| `MAX(prop)` | Finds maximum value | `.value` |
| `MIN(prop)` | Finds minimum value | `.value` |
| `GROUP_BY(prop, sink)` | Groups results by property | `.groups` |
| `MAP(prop)` | Projects single property from each object | `.array` |
| `UNIQUE(prop, sink)` | Filters distinct values | — | [6](#0-5)

### Usage Examples

```javascript
// Collect all results
var sink = await dao.select();
console.log(sink.array);

// Count matching objects
var count = await dao.select(COUNT());
console.log(count.value);

// Group by category with counts
dao.select(GROUP_BY(MyModel.CATEGORY)).then(sink => {
  console.log(sink.groups);
});
``` [7](#0-6)

## Sink Delegation

Sinks can be composed through delegation, where one sink processes results and passes them to another sink for further processing [8](#0-7) :

```javascript
// Filter → Transform → Collect
var sink = PredicatedSink.create({
  predicate: someCondition,
  delegate: Map.create({
    arg1: MyModel.NAME,
    delegate: ArraySink.create()
  })
});
```

## Custom Sinks

You can create custom sinks by implementing the Sink interface:

```javascript
foam.CLASS({
  name: 'CustomSink',
  implements: ['foam.dao.Sink'],
  methods: [
    function put(obj, sub) {
      // Process each object
      console.log('Received:', obj);
    },
    function eof() {
      // Called when complete
      console.log('All data received');
    }
  ]
});
``` [9](#0-8)

For cross-platform sinks, provide both JavaScript and Java implementations to enable server-side execution, which reduces network traffic by processing data where it resides [10](#0-9) .

## Specialized Sinks

FOAM includes specialized sinks for specific use cases:
- `FnSink` - Converts all sink events to calls on a single function [11](#0-10)
- `OrderedSink` - Sorts results before delegating to another sink [12](#0-11)
- `NullSink` - Do-nothing sink (Null Pattern) [13](#0-12)
- `Sequence` - Executes multiple sinks in sequence [14](#0-13)

## Notes

- Sinks are primarily used with `dao.select()` but also work with `dao.listen()` for real-time updates
- The `select()` method returns a Promise that resolves with the sink containing results
- Sink delegation enables multi-stage processing pipelines
- Server-side sink execution is important for performance with large datasets
- The `sub.detach()` method allows early termination of data streams
