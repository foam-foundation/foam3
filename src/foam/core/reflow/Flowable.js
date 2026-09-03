/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Flowable',

  topics: [ 'flowUpdated' ],

  imports: [ 'softSelected' ],

  css: `
    ^dependent {
      border: 1px solid orange !important;
    }
    ^error {
      color: $textDestructive;
    }
  `,

  properties: [
    {
      name: 'flowParent',
      hidden: true,
      transient: true
    },
    {
      class: 'String',
      name: 'flowName',
    },
    {
      class: 'String',
      name: 'error',
      reactive: false,
      transient: true,
      hidden: true,
      visibility: 'RO',
      expression: function(value$reactionError_) {
        // console.log('************** Flowable error:', value$reactionError_);
        return value$reactionError_;
      },
      visibility: function(error) {
        return error ? foam.u2.DisplayMode.HIDDEN : foam.u2.DisplayMode.RO;
      }
    },
    {
      class: 'Array',
      name: 'flowChildren',
      hidden: true
    },
    { name: 'value', hidden: true },
    {
      name: 'treeRowRenderer',
      hidden: true,
      value: function(e) {
        e.parentNode.enableClass('locked', this.locked$);
        e.parentNode.tooltip$ = this.dependencies$.map(d => d.length ? 'Dependents: ' + d.join(',') : '');

        let dependent$ = this.softSelected$.map(s => s && s.dependencies.indexOf(this.flowName) != -1);

        e.enableClass(this.myClass('error'), this.error$);
        e.parentNode.enableClass(this.myClass('dependent'), dependent$);
        e.tooltip$ = this.error$;
        e.add(this.flowName$);
      }
    },
    {
      name: 'childType',
      hidden: true,
      transient: true,
      documentation: 'Default child type for this flowable',
      factory: function() { return this.cls_; }
    },
    {
      class: 'StringArray',
      name: 'dependencies',
      transient: true
    },
    {
      class: 'Boolean',
      name: 'locked',
      transient: true,
      expression: function(dependencies) {
        return dependencies.length != 0;
      }
    }
  ],

  methods: [
    function detachFlowChild(c) {
      // Helper function to properly detach a flow child
      // Detach the block's value first (e.g., Script, etc.)
      if ( c.value && c.value.detach ) {
        c.value.detach();
      }
      // Then detach the block wrapper itself
      if ( c.detach ) {
        c.detach();
      }
    },

    function toSummary() {
      return this.flowName;
    },

    function flowRoot() {
      /** The Console at the top of the flowParent chain. */
      var f = this;
      while ( f.flowParent ) f = f.flowParent;
      return f;
    },

    function flattenFlow() {
      /** Every block below this one in document order, parent before its children. */
      var out = [];
      ( function walk(l) { l.forEach(b => { out.push(b); walk(b.flowChildren || []); }); } )(this.flowChildren);
      return out;
    },

    function createFlowChildName(prefix) {
      for ( var i = 1, name = prefix ; ; ) {
        name = prefix + i++;
        if ( ! this.findFlowChildByName(name) ) return name;
      }
    },

    function findFlowChildByName(n) {
      let findEl = inputArr => {
        if ( ! inputArr?.length ) return;
        for ( v of inputArr ) {
          if ( ! v ) continue;
          if ( v.flowName === n ) {
            return v;
          }
          let ret = findEl(v.flowChildren);
          if ( ret ) return ret;
        }
      };
      return findEl(this.flowChildren);
    },

    function addFlowChild(f) {
      if ( f.deleted_ ) return;
      f.flowParent = this;
      this.flowChildren$push(f);
      this?.addFlowChild_(f);
    },

    function removeFlowChild(f) {
      var index = this.flowChildren.indexOf(f);
      this.flowChildren = this.flowChildren.filter(c => c != f);
      this?.removeFlowChild_(f);

      if ( this.selected === f ) {
        if ( this.flowChildren.length > 0 ) {
          var newIndex = Math.max(0, index - 1);
          this.selected = this.flowChildren[newIndex];
        } else {
          this.selected = null;
        }
      }
    },

    function removeAllFlowChildren() {
      this.flowChildren.forEach(c => {
        this.removeFlowChild_(c);
        this.detachFlowChild(c);
      });
      this.flowChildren = [];
    }
  ]
});
