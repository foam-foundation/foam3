# Listeners

Listeners are methods that stay bound to their owner. In plain JavaScript, passing a method as a callback loses `this`:

```javascript
alarm.ring.sub(sprinkler.onAlarm);  // 'this' is gone inside onAlarm
```

You'd normally fix this with `.bind()`:

```javascript
alarm.ring.sub(sprinkler.onAlarm.bind(sprinkler));  // works, but manual
```

FOAM listeners handle binding automatically. Declare a function inside `listeners:` and it stays bound to its object everywhere:

```javascript
alarm.ring.sub(sprinkler.onAlarm);  // 'this' = sprinkler. Always.
```

---

## Declaring Listeners

### Short Form

For simple listeners with no options:

```javascript
listeners: [
  function onAlarm() {
    console.log('Alarm fired for', this.name);
  }
]
```

The function must be named — anonymous functions are rejected.

### Long Form

For listeners that need timing control or auto-subscription:

```javascript
listeners: [
  {
    name: 'onResize',
    isMerged: true,
    delay: 100,
    code: function() {
      this.relayout();
    }
  }
]
```

---

## Topics (Pub/Sub)

Every FOAM object has a built-in publish/subscribe system called **topics**. A topic is a named channel that objects use to announce events. Other objects subscribe to those channels to react.

When a property changes, FOAM automatically publishes to a topic called `propertyChange`:

```
+------------------+                    +------------------+
|     Person       |                    |    Subscriber    |
|                  |   pub/sub topic    |                  |
|  firstName = ?   |  'propertyChange'  |  onNameChange()  |
|                  | .................. |                  |
+------------------+   'firstName'      +------------------+
```

Publishing happens automatically — you never call `pub()` for property changes. Subscribing is what listeners are for.

A topic path has segments separated by dots. The more segments you specify, the more specific the subscription:

```javascript
// Subscribe to ALL property changes on person
person.sub('propertyChange', listener);

// Subscribe to ONLY firstName changes on person
person.sub('propertyChange', 'firstName', listener);
```

Think of topics like a file path. `propertyChange` is the folder, `firstName` is a specific file inside it. Subscribing to the folder gives you everything; subscribing to the file gives you just that one.

---

## Subscribing a Listener

### Manual subscription

```javascript
this.amount$.sub(this.onAmountChange);
```

Or subscribe to a topic directly:

```javascript
alarm.sub('ring', sprinkler.onAlarm);
```

### Automatic subscription with `on:`

Instead of wiring subscriptions in `init()`, declare them on the listener:

```javascript
listeners: [
  {
    name: 'onDataChange',
    on: [ 'this.propertyChange.items' ],
    code: function() {
      this.refreshList();
    }
  }
]
```

This is equivalent to writing:

```javascript
methods: [
  function init() {
    this.items$.sub(this.onDataChange);
  }
]
```

#### `on:` topic syntax

Each `on:` entry is a dot-separated string. The first segment picks the target object. Everything after is the topic path passed to `.sub()`.

```
on: [ 'this.propertyChange.amount' ]
       ^^^^  ^^^^^^^^^^^^^^^^^^^^^^^
       |     topic: 'propertyChange', 'amount'
       |
       target: this
```

| `on:` value | Target | Subscribes to |
|-------------|--------|---------------|
| `'this.propertyChange.amount'` | `this` | Changes to `amount` on this object |
| `'data.propertyChange'` | `this.data` | All property changes on `this.data` |
| `'data.propertyChange.name'` | `this.data` | Changes to `name` on `this.data` |

`'this'` and `''` (empty string) both mean `this`. Any other first segment means `this[segment]`.

Subscribe to multiple topics with an array:

```javascript
on: [
  'this.propertyChange.firstName',
  'this.propertyChange.lastName'
]
```

---

## Timing Modes

By default, a listener fires every time it's called. For events that fire rapidly — window resize, keystrokes, property changes during bulk updates — this wastes work. FOAM provides three throttling modes.

### No throttling (default)

```javascript
{
  name: 'onEveryChange',
  code: function() {
    console.log('fires every single time');
  }
}
```

If the event fires 50 times, the listener runs 50 times:

```
time --->

Events:  v  v  v  v  v  v  v  v  v  v
         |  |  |  |  |  |  |  |  |  |
Runs:    *  *  *  *  *  *  *  *  *  *

         10 runs for 10 events
```

### `isFramed` — once per screen paint

```javascript
{
  name: 'onRepaint',
  isFramed: true,
  code: function() {
    this.chart.update();
  }
}
```

The first call schedules the listener on the next `requestAnimationFrame`. All calls before the screen paints are collapsed into one. The listener uses the arguments from the most recent call.

```
time --->
                    screen               screen
                    paints               paints
                      v                    v
Events:  v  v  v  v  |     v  v  v        |
         |  |  |  |  |     |  |  |        |
         x  x  x  |  |     x  x  |        |
                  \|  |         \  |        |
Runs:              *  |          * |        |
                      |            |
                   +--+         +--+
                   ~16ms        ~16ms
                   (1 frame)    (1 frame)

         2 runs for 7 events
```

Good for: chart redraws, DOM updates, layout recalculations — anything visual. The browser only paints ~60 times per second, so running more often than that wastes work.

### `isMerged` — once after first call + delay

```javascript
{
  name: 'onSearch',
  isMerged: true,
  delay: 200,
  code: function() {
    this.runSearch();
  }
}
```

The first call starts a timer. All calls within the delay window are ignored. The listener fires once when the timer expires, with the most recent arguments. A new call after the timer fires starts a new window.

```
time --->

Events:  v  v  v  v           v  v  v
         |  |  |  |           |  |  |
         |  x  x  x           |  x  x
         |                     |
         +-----[200ms]----+   +-----[200ms]----+
                           |                    |
Runs:                      *                    *

         first call         first call
         starts timer       starts new timer

         2 runs for 7 events
```

Good for: network requests, expensive computations. The listener responds quickly after the first trigger (within one delay window) but ignores the rapid follow-ups.

### `isIdled` — once after activity stops

```javascript
{
  name: 'onSearchIdle',
  isIdled: true,
  delay: 300,
  code: function() {
    this.runSearch();
  }
}
```

Each call resets the timer. The listener fires only after `delay` ms of silence — no new calls. Uses the most recent arguments.

```
time --->

Events:  v  v  v  v                    v  v        v
         |  |  |  |                    |  |        |
         |  |  |  |                    |  |        |
         |  |  |  +---[300ms]----+     |  +---[300ms]----+
         |  |  +--x    reset     |     +--x    reset     |
         |  +--x                 |                        |
         +--x                    |                        |
                                 |                        |
Runs:                            *                        *

         each call               each call
         resets the              resets the
         timer                   timer

         2 runs for 7 events
```

Good for: search-as-you-type, autosave, form validation. The listener waits until the user stops doing things, then acts on the final state.

### `isMerged` vs `isIdled` — side by side

The difference matters when calls keep arriving:

```
time --->

Events:    v  v  v  v  v  v  v  v  v              (continuous rapid events)
           |  |  |  |  |  |  |  |  |

Merged:    +------[delay]------+                   fires DURING the burst
                               *                   (after first call + delay)

Idled:     x  x  x  x  x  x  x  x  +--[delay]--+ fires AFTER the burst
                                                  * (after silence + delay)
```

`isMerged` guarantees a response within `delay` ms of the first call, even if calls keep coming. `isIdled` waits for calm — if calls never stop, the listener never fires.

### `delay` property

`delay` sets the timer duration in milliseconds for `isMerged` and `isIdled`. Default is 16ms (roughly one frame).

`mergeDelay` is a legacy alias — it reads and writes `delay`. Use `delay` in new code.

---

## Detach Safety

Listeners automatically check if their owner has been detached before running. If an object is detached (removed from the DOM, cleaned up), pending callbacks from timers or animation frames are silently dropped. You don't need to manually cancel anything.

```javascript
// Even if a merged timer fires after obj is detached,
// the listener code never runs — no stale updates.
obj.detach();
```

---

## Full Example

A chart component that redraws when its data changes, throttled to one repaint per animation frame:

```javascript
foam.CLASS({
  name: 'PieChart',
  extends: 'foam.graphics.CView',

  properties: [
    'chart',
    {
      name: 'data',
      factory: function() {
        return { labels: [], datasets: [] };
      }
    }
  ],

  methods: [
    function paintSelf(x) {
      if ( ! this.chart ) {
        this.chart = new Chart(x, { type: 'pie', data: this.data });
        this.update();
      }
      this.chart.render();
    }
  ],

  listeners: [
    {
      name: 'update',
      isFramed: true,
      on: [ 'this.propertyChange.data' ],
      code: function() {
        if ( ! this.chart ) return;
        this.chart.data = this.data;
        this.chart.update();
      }
    }
  ]
});
```

What happens here:
- `on: ['this.propertyChange.data']` — auto-subscribes `update` to data changes
- `isFramed: true` — batches rapid data changes into one repaint per frame
- Pre-bound `this` — `this.chart` always refers to the PieChart instance
- Detach safety — if the chart is removed, pending frame callbacks do nothing

---

## Gotchas

### `delay` without `isMerged` or `isIdled` does nothing

```javascript
// WRONG — delay is ignored, listener fires every call
{
  name: 'onUpdate',
  delay: 500,
  code: function() { ... }
}

// CORRECT — delay needs a timing mode
{
  name: 'onUpdate',
  isMerged: true,
  delay: 500,
  code: function() { ... }
}
```

`delay` is only read when `isMerged` or `isIdled` is true. Without one of those flags, the listener fires on every call regardless of the delay value.

### `isFramed` ignores `delay`

```javascript
// delay has no effect here — framed uses requestAnimationFrame timing
{
  name: 'onRepaint',
  isFramed: true,
  delay: 500,      // ignored
  code: function() { ... }
}
```

`isFramed` fires on the next animation frame (~16ms). The `delay` property is not used.

### Only one timing mode at a time

The modes are checked in order: `isMerged` → `isIdled` → `isFramed`. If you set multiple flags, only the first match applies:

```javascript
// WRONG — only isMerged takes effect, isFramed is ignored
{
  name: 'onUpdate',
  isMerged: true,
  isFramed: true,
  code: function() { ... }
}
```

Pick one mode per listener.

### Short-form listeners can't have options

```javascript
// WRONG — there's no way to add isMerged to short form
listeners: [
  function onResize() { this.relayout(); }  // always raw, no throttle
]

// CORRECT — use long form for options
listeners: [
  {
    name: 'onResize',
    isMerged: true,
    delay: 100,
    code: function() { this.relayout(); }
  }
]
```

### Listener names must be unique

Listeners are installed as property getters on the prototype. A listener named `onUpdate` would collide with a property named `onUpdate`. Use descriptive names that won't clash.

### `on:` target must exist at init time

```javascript
// If this.data is null when the object is created, this subscription is skipped
on: [ 'data.propertyChange.items' ]
```

The `on:` wiring runs during `initObject`. If the target (`this.data`) is null or undefined at that point, the subscription is silently skipped. Make sure the target exists before the object is created, or wire the subscription manually in a `postSet` or after the target is set.
