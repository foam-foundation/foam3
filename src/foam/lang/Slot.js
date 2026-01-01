/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'Slot', // ???: Rename AbstractSlot or make an Interface

  requires: [
    'foam.lang.internal.And',
    'foam.lang.internal.DedupSlot',
    'foam.lang.internal.FramedSlot',
    'foam.lang.internal.IndexedSlot',
    'foam.lang.internal.Not',
    'foam.lang.internal.Or',
    'foam.lang.internal.SubSlot'
  ],

  documentation: `
    Slots are observable values which can change over time.

    Slots are simple single-value Model-View-Controller Models, but since
    another meaning of 'Model' is already heavily used in FOAM, Slot is
    used to avoid overloading the term.

    <ul>Types of Slots include:
      <li>PropertySlot
      <li>ConstantSlot
      <li>ExpressionSlot
    </ul>
  `,

  methods: [
    /**
      Subscribe to the Slot's value, if it has one. If the Slot's
      value changes, then unsubscribe from the previous value and
      resubscribe to the new one.
    */
    function valueSub() {
      var self = this;
      var args = Array.from(arguments);
      var s;
      var l = function() {
        var v = self.get();
        if ( s ) s.detach();
        if ( v ) s = v.sub.apply(v, args);
      };
      l();
      this.sub(l);
    },

    /**
      Create a sub-Slot for this Slot's value. If this Slot's
      value changes, then the sub-Slot becomes the Slot for
      the new value's sub-Slot instead. Useful for creating
      Slot paths without having to rebuild whenever a value
      along the chain changes.
    */
    function dot(name) {
      var i = name.indexOf('$');
      if ( i != -1 ) {
        var left  = name.substring(0, i);
        var right = name.substring(i + 1);
        return this.SubSlot.create({
          parent: this,
          name:   left
        }).dot(right);
      } else {
        return this.SubSlot.create({
          parent: this,
          name:   name
        });
      }
    },

    /**
      Create an IndexedSlot for an indexed item from this Slot's value. If this Slot's
      value changes, then the IndexedSlot becomes the Slot for
      the new value's indexed value instead. Useful for creating
      Slot paths without having to rebuild whenever a value
      along the chain changes. Unlike dot(), which works with FObjects, at() works
      with maps and arrays.
    */
    function at(index) {
      return this.IndexedSlot.create({
        parent: this,
        name:   index
      });
    },

    function framed() {
      return this.FramedSlot.create({delegate: this});
    },

    function dedup() {
      return this.DedupSlot.create({delegate: this});
    },

    // TODO: remove when all code ported
    function link(other) {
      console.warn('deprecated use of link(), use linkFrom() instead');
      return this.linkFrom(other);
    },

    /**
      Link two Slots together, setting both to other's value.
      Returns a Detachable which can be used to break the link.
      After copying a value from one slot to the other, this implementation
      then copies the value back in case the target slot rejected the value.
    */
    function linkFrom(s2) {
      var s1        = this;
      var feedback1 = false;
      var feedback2 = false;

      // TODO: once all slot types property set 'src', these
      // two listeneners can be merged.
      var l1 = function(e) {
        if ( feedback1 ) return;

        if ( ! foam.util.is(s1.get(), s2.get()) ) {
          feedback1 = true;
          try {
            s2.set(s1.get());
            if ( ! foam.util.is(s1.get(), s2.get()) )
              s1.set(s2.get());
          } finally {
            feedback1 = false;
          }
        }
      };

      var l2 = function(e) {
        if ( feedback2 ) return;

        if ( ! foam.util.is(s1.get(), s2.get()) ) {
          feedback2 = true;
          try {
            s1.set(s2.get());
            if ( ! foam.util.is(s1.get(), s2.get()) )
              s2.set(s1.get());
          } finally {
            feedback2 = false;
          }
        }
      };

      var sub1 = s1.sub(l1);
      var sub2 = s2.sub(l2);

      l2();

      return {
        detach: function() {
          sub1 && sub1.detach();
          sub2 && sub2.detach();
          sub1 = sub2 = null;
        }
      };
    },

    function linkTo(other) {
      return other.linkFrom(this);
    },

    /**
      Have this Slot dynamically follow other's value.
      Returns a Detachable which can be used to cancel the binding.
    */
    function follow(other) {
      foam.assert(other, 'Slot.follow requires Slot argument.');
      var self = this;
      var l = function() {
        if ( ! foam.util.is(self.get(), other.get()) ) {
          self.set(other.get());
        }
      };
      l();
      return other.sub(l);
    },

    function and(other) {
      return this.And.create({ a$: this, b$: other }).output$;
    },

    function or(other) {
      return this.Or.create({ a$: this, b$: other }).output$;
    },

    function not() {
      return this.Not.create({ a$: this }).output$;
    },

    /**
     * Maps values from one model to another.
     * @param f maps values from srcValue to dstValue
     */
    function mapFrom(other, f) {
      var self = this;
      var l = function() { self.set(f(other.get())); };
      l();
      return other.sub(l);
    },

    function mapTo(other, f) {
      return other.mapFrom(this, f);
    },

    function map(f) {
      return foam.lang.ExpressionSlot.create({code: f, args: [this]});
    },

    /**
     * Relate to another Slot.
     * @param f maps from this to other
     * @param fprime maps other to this
     */
    function relateTo(other, f, fPrime) {
      var self     = this;
      var feedback = false;
      var sub      = foam.lang.FObject.create();
      var l1 = function() {
        if ( feedback ) return;
        feedback = true;
        other.set(f(self.get()));
        feedback = false;
      };
      var l2 = function() {
        if ( feedback ) return;
        feedback = true;
        self.set(fPrime(other.get()));
        feedback = false;
      };

      sub.onDetach(this.sub(l1));
      sub.onDetach(other.sub(l2));

      l1();

      return sub;
    },

    function relateFrom(other, f, fPrime) {
      return other.relateTo(this, fPrime, f);
    },

    function toE() {
      return this;
    }
  ]
});


foam.CLASS({
  package: 'foam.lang.internal',
  name: 'PropertySlot',
  extends: 'foam.lang.Slot',

  documentation: `
    Represents object properties as Slots.
    Created with calling obj.prop$ or obj.slot('prop').
    For internal use only.
  `,

  methods: [
    function initArgs() { },
    function init() { },

    function get() {
      return this.prop.get(this.obj);
    },

    function set(value) {
      return this.prop.set(this.obj, value);
    },

    function getPrev() {
      return this.oldValue;
    },

    function setPrev(value) {
      return this.oldValue = value;
    },

    function sub(l) {
      var s = this.obj.sub('propertyChange', this.prop.name, l);
      s.src = this;
      return s;
    },

    function isDefined() {
      return this.obj.hasOwnProperty(this.prop.name);
    },

    function clear() {
      this.obj.clearProperty(this.prop.name);
    },

    function toString() {
      return 'PropertySlot(' + this.obj.$UID + ',' + this.obj.cls_.id + '.' + this.prop.name + ')';
    }
  ]
});


foam.CLASS({
  package: 'foam.lang.internal',
  name: 'SubSlot',
  extends: 'foam.lang.Slot',

  documentation:
      'For internal use only. Is used to implement the Slot.dot() method.',

  properties: [
    'parent', // parent slot, not parent object
    'name',
    'value',
    'prevSub'
  ],

  methods: [
    function init() {
      this.onDetach(this.parent.sub(this.parentChange));
      this.parentChange();
    },

    function get() {
      var o = this.parent.get();

      return o && o[this.name];
    },

    function set(value) {
      var o = this.parent.get();

      if ( o ) o[this.name] = value;
    },

    /** Needed? **/
    function getPrev() {
      return this.oldValue;
    },

    /** Needed? **/
    function setPrev(value) {
      return this.oldValue = value;
    },

    function sub(l) {
      if ( arguments.length == 1 )
        return this.SUPER('propertyChange', 'value', l);

      // Could happen if any arguments are passed to sub(), like would happen if onDetach() called.
      return this.SUPER.apply(this, arguments);
    },

    function isDefined() {
      return this.parent.get().hasOwnProperty(this.name);
    },

    function clear() {
      this.parent.get().clearProperty(this.name);
    },

    function toString() {
      return 'SubSlot(' + this.parent + ',' + this.name + ')';
    }
  ],

  listeners: [
    function parentChange(s) {
      this.prevSub && this.prevSub.detach();
      var o = this.parent.get();

      // If the new class has the same axiom as the old class, then we keep this
      // SubSlot attached instead of detaching it.
      if ( o && o.cls_.getAxiomByName(this.name) == null ) {
        this.prevSub = null;
        this.detach();
        return;
      }

      this.prevSub = o && o.slot && this.onDetach(o.slot(this.name).sub(this.valueChange));
      this.valueChange();
    },

    function valueChange() {
      var parentValue = this.parent.get();
      this.value = parentValue ? parentValue[this.name] : undefined;
    }
  ]
});


foam.CLASS({
  package: 'foam.lang.internal',
  name: 'Or',

  properties: [
    'a',
    'b',
    {
      name: 'output',
      expression: function (a, b) {
        return a || b;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.lang.internal',
  name: 'And',

  properties: [
    'a',
    'b',
    {
      name: 'output',
      expression: function (a, b) {
        return !! ( a && b );
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.lang.internal',
  name: 'Not',

  properties: [
    'a',
    {
      name: 'output',
      expression: function(a) {
        return ! a;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'ConstantSlot',
  extends: 'foam.lang.Slot',

  documentation: 'An immutable constant valued Slot.',

  axioms: [
    {
      // Lots of identical ConstantSlots are created so cache instances
      // for string, boolean and enum values
      installInClass: function(cls) {
        let map = {};
        let oldCreate = cls.create;
        cls.create = function(args) {
          if ( args && args.value ) {
            let value = args.value;
            let type  = typeof value;

            if ( type === 'string' || type  === 'boolean' || ( foam.lang.AbstractEnum && foam.lang.AbstractEnum.isInstance(value) ) ) {
              let key = typeof value + value.toString();
              if ( ! map[key] ) {
                map[key] = oldCreate.apply(this, arguments);
              }
              return map[key];
            }
          }
          return oldCreate.apply(this, arguments);
        };
      }
    }
  ],

  properties: [
    {
      name: 'value',
      getter: function() { return this.value_; },
      setter: function() {}
    }
  ],

  methods: [
    function initArgs(args) { this.value_ = args && args.value; },

    function get() { return this.value; },

    function set() {
      throw new Error('Tried to mutate immutable ConstantSlot.');
    },

    function sub(l) { /* nop */ },

    function follow(other) { /* nop */ },

    function linkFrom(s2) { /* nop */ },

    function linkTo(s2) { s2.set(this.get()); },

    function mapFrom(other, f) { /* nop */ }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'ExpressionSlot',
  extends: 'foam.lang.PromiseSlot',

  documentation: `
    Tracks dependencies for a dynamic function and invalidates if they change.
    Note that ExpressionSlots are lazily evaluated, even if you sub(), so
    updates will not be generated from calling .sub() unless you also call
    .get().

    <pre>
      foam.CLASS({name: 'Person', properties: ['fname', 'lname']});
      var p = Person.create({fname: 'John', lname: 'Smith'});
      var e = foam.lang.ExpressionSlot.create({
        args: [ p.fname$, p.lname$ ],
        code: function(f, l) { return f + ' ' + l; }
      });
      log(e.get());
      e.sub(log);
      p.fname = 'Steve';
      p.lname = 'Jones';
      log(e.get());

      Output:
       > John Smith
       > [object Object] propertyChange value [object Object]
       > [object Object] propertyChange value [object Object]
       > Steve Jones

      var p = foam.CLASS({name: 'Person', properties: [ 'f', 'l' ]}).create({f:'John', l: 'Doe'});
      var e = foam.lang.ExpressionSlot.create({
        obj: p,
        code: function(f, l) { return f + ' ' + l; }
      });
    </pre>
  `,

  properties: [
    'obj',
    'code',
    {
      name: 'args',
      expression: function(obj) {
        foam.assert(obj, 'ExpressionSlot: "obj" or "args" required.');

        var args = foam.Function.argNames(this.code);
        for ( var i = 0 ; i < args.length ; i++ ) {
          args[i] = obj.slot(args[i]);
        }

        // this.invalidate(); // ???: Is this needed?
        this.subToArgs_(args);

        return args;
      },
      postSet: function(_, args) {
        this.subToArgs_(args);
      }
    },
    {
      name: 'value',
      preSet: function(o, n) {
        if ( n && n.then ) {
          this.promise = n;
          n = foam.Undefined.isInstance(o) ? null : o;
        } else {
          // Ensure an old promise doesn't fire and clobber the value.
          this.promise = null;
        }
        return n;
      },
      factory: function() {
        return this.code.apply(this.obj || this, this.args.map(function(a) {
          return a && a.get();
        }));
      }
    },
    'cleanup_', // detachable to cleanup old subs when obj changes
  ],

  methods: [
    function init() { this.onDetach(this.cleanup); },
    function set() { /* nop */ },
    function subToArgs_(args) {
      this.cleanup();
      const subs = args.map(a => a && a.sub(this.invalidate));

      this.cleanup_ = {
        detach: function() {
          for ( var i = 0 ; i < subs.length ; i++ ) {
            if ( subs[i] ) subs[i].detach();
          }
        }
      };
    },
    function detach() {
      this.cleanup();
      this.SUPER();
    }
  ],

  listeners: [
    function cleanup() {
      if ( this.cleanup_ ) {
        this.cleanup_.detach();
        this.cleanup_ = null;
      }
    },
    function invalidate() {
      this.clearProperty('value');
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'DynamicFunction',
  extends: 'foam.lang.ExpressionSlot',

  documentation: 'self is "this" when code is called, but obj is source of expression arguments',

  properties: [
    {
      name: 'self',
      factory: function() { return this.obj; }
    },
    {
      class: 'Int',
      name: 'seqNo',
      documentation: 'An incrementing value which increases everytime "code" is called. Used to create a changing value.'
    },
    {
      name: 'pre',
      documentation: 'Called before "code" is called.',
      value: function() {}
    },
    {
      name: 'post',
      documentation: 'Called after "code" is called.',
      value: function() {}
    },
    {
      name: 'value',
      factory: function() {
        /* ignoreWarning */
        var self = this.self || this.obj || this;

        // running: if this factory is currently being run but returned a promise and
        // hasn't completed. If running, then don't run again, instead just set rerun.
        // rerun: means another update has occured and the currently running execution
        // is stale. When done computing, invalidate so that it is updated again.
        if ( this.running ) { this.rerun = true; return this.seqNo; }
        this.running = true;
        this.pre.call(self);
        var ret = this.code.apply(self, this.args.map(a => a && a.get()));
        var after = () => {
          this.post.call(self);
          this.running = false;
          if ( this.rerun ) {
            this.rerun = false;
            this.invalidate();
          }
        };
        if ( ret && ret.then ) {
          ret.then(after);
        } else {
          after();
        }
        return this.seqNo++;
      }
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      var i = globalThis.requestAnimationFrame(() => this.value);
      this.onDetach(() => globalThis.cancelAnimationFrame(i));
    },
    function subToArgs_(args) {
      // Overrides implementation in ExpressionSlot
      // Difference is an Expression only computes updated value if someone
      // has done a get() on the Slot, so is pull-based, but a DynamicFunction
      // always updates, even if nobody is get()-ing the value. This makes
      // it suitable as a kind of compound listener.
      const subs = args.map(a => a && a.sub(this.invalidate));

      if ( ! this.cleanup_ ) {
        this.cleanup_ = {
          detach: function() {
            for ( var i = 0 ; i < subs.length ; i++ ) {
              if ( subs[i] ) subs[i].detach();
            }
          }
        };
      }
    }
  ],

  listeners: [
    {
      name: 'invalidate',
      isFramed: true,
      code: function invalidate() {
        // Overrides implementation in ExpressionSlot, but also calls this.value
        // which, unlike ExpressionSlot, forces value to be eagerly evaluated.
        this.clearProperty('value');
        this.value;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'PromiseSlot',
  extends: 'foam.lang.SimpleSlot',

  documentation: `
    A slot that takes a promise and sets its value to its value when it
    resolves.
  `,

  properties: [
    {
      name: 'promise',
      postSet: function(_, n) {
        n && n.then(function(v) {
          if ( n === this.promise && this.value != v ) this.value = v;
        }.bind(this));
      }
    }
  ],

  methods: [
    function set() {
      throw new Error(this.cls_.id + ' does not support setting.');
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'ArraySlot',

  extends: 'foam.lang.Slot',

  documentation: `
    A slot that takes an array of Slots and notifies when either changes.
  `,

  properties: [
    {
      class: 'FObjectArray',
      of: 'foam.lang.Slot',
      name: 'slots'
    }
  ],

  methods: [
    function get() {
      return this.slots.map(s => s.get());
    },

    function set(arr) {
      if ( ! foam.Array.isInstance(arr) )
        throw new Error('ArraySlot can only set an array.');
      arr.forEach((v, i) => this.slots[i].set(v));
    },

    function sub(l) {
      if ( arguments.length != 1 ) return this.SUPER.apply(this, arguments);
      var subs = this.slots.map(s => s.sub(l));
      return {
        detach: function() { subs.forEach(s => s && s.detach()); }
      };
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'SimpleSlot',
  extends: 'foam.lang.Slot',

  properties: [
    {
      name: 'value'
    }
  ],

  methods: [
    function get() { return this.value; },
    function set(v) { this.value = v; },
    function sub(l) {
      return arguments.length === 1 ?
        this.SUPER('propertyChange', 'value', l) :
        this.SUPER.apply(this, arguments);
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'ProxySlot',
  extends: 'foam.lang.SimpleSlot',
  properties: [
    {
      name: 'sub_'
    },
    {
      name: 'delegate',
      postSet: function(_, n) {
        if ( this.sub_ ) this.sub_.detach();

        if ( foam.lang.Slot.isInstance(n) ) {
          this.sub_ = this.linkFrom(n);
        }
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.lang.internal',
  name: 'FramedSlot',
  extends: 'foam.lang.SimpleSlot',

  documentation: `Create a Slot where updates are delayed until the next animation frame, and are
  then ignored if the value didn't actually update.`,

  properties: [
    {
      name: 'sub_'
    },
    {
      name: 'delegate',
      postSet: function(o, n) {
        if ( this.sub_ ) this.sub_.detach();

        if ( foam.lang.Slot.isInstance(n) ) {
          this.sub_ = n.sub(this.update);
          this.updateNow();
        }
      }
    }
  ],

  methods: [
    function set(v) {
      this.value = v;
      this.delegate.set(v);
    },

    function framed() {
      return this; // already framed, so just return this
    },

    function dedup() {
      return this; // already framed, so just return this
    }
  ],

  listeners: [
    {
      name: 'update',
      isFramed: true,
      code: function() { this.updateNow(); }
    },
    {
      name: 'updateNow',
      code: function() {
        var newValue = this.delegate.get();
        // Just do === not equals() check for FObjects and Objects
        if ( foam.lang.FObject.isInstance(newValue) || foam.Object.isInstance(newValue) ) {
          if ( this.value !== newValue ) {
            this.value = newValue;
          }
        } else if ( ! foam.util.equals(this.value, newValue) ) {
          this.value = newValue;
        } else {
        //  console.log('avoid stale notify');
        }
      }
    }
  ]
});



foam.CLASS({
  package: 'foam.lang.internal',
  name: 'DedupSlot',
  extends: 'foam.lang.internal.FramedSlot',

  methods: [
    function framed() {
      return this.delegate.framed();
    }
  ],

  listeners: [
    {
      name: 'update',
      isFramed: false,
      code: function() { this.updateNow(); }
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'ProxyExpressionSlot',
  extends: 'foam.lang.ProxySlot',

  requires: [
    'foam.lang.ExpressionSlot'
  ],

  documentation: "An expression slot which supports 'obj' changing.",

  properties: [
    {
      name: 'obj',
      postSet: function () {
        this.update();
      }
    },
    {
      name: 'code',
      postSet: function () {
        this.update();
      }
    },
    {
      name: 'args',
      postSet: function () {
        this.update();
      }
    }
  ],

  methods: [
    function update() {
      if ( ! this.code || ! this.obj ) return;

      this.delegate = this.ExpressionSlot.create({
        args: this.args,
        code: this.code,
        obj:  this.obj
      })
    }
  ]
});


foam.CLASS({
  package: 'foam.lang.internal',
  name: 'IndexedSlot',
  extends: 'foam.lang.internal.SubSlot',

  documentation: 'A slot for accessing an element of a parent slot. Works for both arrays and maps.',

  methods: [
    function set(value) {
      var o = this.parent.get() || [];
      var a = foam.util.clone(o);

      a[this.name] = value;
      this.parent.set(a);
    },
    function toString() {
      return 'IndexedSlot(' + this.parent + '[' + this.name + '])';
    }
  ],
  listeners: [
    function parentChange(s) {
      this.value = this.get();
    }
  ]
});
