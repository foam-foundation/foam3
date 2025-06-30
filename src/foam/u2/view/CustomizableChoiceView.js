/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'CustomizableChoiceView',
  extends: 'foam.u2.View',

  implements: [ 'foam.mlang.Expressions' ],

  imports: [ 'warn', 'window', 'ctrl?' ],

  documentation: `
    EnhancedChoiceView is a custom choice view that extends the original ChoiceView.
    It adds the following features:
      - A search input field that allows the user to search for choices.
      - A list of choices that are displayed in a dropdown menu.
      - A button to clear the selection.
      - A button to add a new choice.
      - A button to remove a choice.
      - Customizable selection view and row view for enhanced display options.
  `,

  properties: [
    {
      class: 'String',
      name: 'name',
      expression: function(prop_) {
        return prop_?.name ?? 'select';
      }
    },
    {
      class: 'String',
      name: 'label',
      documentation: `User-visible label. Not to be confused with "text",
          'which is the user-visible name of the currently selected choice.`
    },
    {
      name: 'choice',
      // 'choice' is the canonical source of truth. Updating 'choice' is
      // responsible for updating 'index', 'data', and 'text'. Updating any
      // of those properties calls back to updating 'choice'.
      documentation: 'The current choice. (That is, a [value, text] pair.)',
      postSet: function(o, n) {
        if ( o === n || this.feedback_ ) return;

        this.feedback_ = true;

        try {
          if ( ! n && this.placeholder ) {
            this.data  = this.defaultValue;
            this.text  = this.placeholder;
            this.index = -1;
          } else {
            this.data  = n && n[0];
            this.text  = n && n[1];
            this.index = this.findIndexOfChoice(n);
          }
        } finally {
          this.feedback_ = false;
        }
      }
    },
    {
      name: 'choices',
      documentation: `Array of [value, text] choices. You can pass in just
          an array of strings, which are expanded to [str, str]. Can also
          be a map, which results in [key, value] pairs listed in
          enumeration order.`,
      factory: function() { return []; },
      adapt: function(old, nu) {
        if ( typeof nu === 'object' && ! Array.isArray(nu) ) {
          var out = [];
          for ( var key in nu ) {
            if ( nu.hasOwnProperty(key) ) out.push([ key, nu[key] ]);
          }
          if ( this.dynamicSize ) {
            this.size = Math.min(out.length, this.maxSize);
          }
          return out;
        }

        nu = foam.Array.shallowClone(nu);

        // Upgrade single values to [value, value].
        for ( var i = 0 ; i < nu.length ; i++ ) {
          if ( ! Array.isArray(nu[i]) ) {
            nu[i] = [ nu[i], nu[i] ];
          }
        }

        if ( this.dynamicSize ) this.size = Math.min(nu.length, this.maxSize);

        return nu;
      },
      postSet: function() {
        if ( this.data ) {
          var choice = this.findChoiceByData(this.data);
          if ( choice !== this.choice ) this.choice = choice;
        }
      }
    },
    {
      class: 'Int',
      name: 'index',
      documentation: 'The index of the current choice in the choices array.',
      transient: true,
      value: -1,
      preSet: function(old, nu) {
        if ( this.choices.length === 0 && this.dao ) return nu;
        if ( nu < 0 && this.placeholder ) return nu;
        if ( nu < 0 || this.choices.length === 0 ) return 0;
        if ( nu >= this.choices.length ) return this.choices.length - 1;
        return nu;
      },
      postSet: function(o, n) {
        if ( o !== n ) this.choice = n === -1 ? null : this.choices[n];
      }
    },
    {
      class: 'String',
      name: 'placeholder',
      factory: function() { return undefined; },
      documentation: 'When provided the placeholder will be prepended to the selection list, and selected if the choices array is empty or no choice in the choices array is selected.'
    },
    {
      class: 'Function',
      name: 'objToChoice',
      value: function(o) { return [ o.id, o.label ]; },
      documentation: 'A function which adapts an object from the DAO to a [key, value] choice. Required when a DAO is provided.'
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'dao'
    },
    {
      name: 'text',
      postSet: function(o, n) {
        if ( o !== n ) this.choice = this.findChoiceByText(n);
      }
    },
    {
      name: 'data',
      postSet: function(o, n) {
        if ( o !== n && ! foam.Null.isInstance(n) ) this.choice = this.findChoiceByData(n) || [n, n.label || n];
      }
    },
    {
      name: 'disabledData',
      documentation: 'Optional slot containing list of choice ids that should be disabled',
      factory: function() {
        return [];
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'selectSpec',
      value: { class: 'foam.u2.tag.Select' }
    },
    {
      class: 'Boolean',
      name: 'alwaysFloatLabel'
    },
    {
      class: 'String',
      name: 'header',
      documentation: 'if this is set, a custom header will be add to drop down choices'
    },
    {
      name: 'view_'
    },
    'feedback_',
    'defaultValue',
    {
      class: 'Int',
      name: 'size',
      documentation: `The number of entries in the HTML 'select' element that
        should be visible.`
    },
    {
      class: 'Boolean',
      name: 'dynamicSize',
      documentation: `The size of the select element (ie: the number of entries
        shown at one time) should match the number of entries in the list. If
        set to true, the 'size' property will be ignored. However, the 'maxSize'
        property will still be respected.`
    },
    {
      class: 'Int',
      name: 'maxSize',
      documentation: `The size of the select element should never be greater
        than this number.`,
      value: Number.MAX_SAFE_INTEGER
    },
    'prop_',
    {
      class: 'Int',
      name: 'seq_'
    }
  ],

  methods: [
    function init() {
      this.onDetach(this.choices$.sub(this.onChoicesUpdate));
    },

    function render() {
      this.SUPER();
      var self = this;

      if ( ! this.choice && this.choices.length == 1 ) this.data = this.choices[0][0];

      // If no item is selected, and data has not been provided, select the 0th
      // entry.
      if ( this.data == null && ! this.index ) {
        this.index = 0;
      }

      this.onDAOUpdate();
      ! this.U3 && this.renderU2Content ? this.renderU2Content() : this.renderContent();
      this.dao$proxy.on.sub(this.onDAOUpdate);
    },
    function renderContent() {
      var self = this;
      this.add(this.slot(function(mode, text) {
        if ( mode !== foam.u2.DisplayMode.RO ) {
          return self.E()
            .start(self.selectSpec, {
              data$:            self.index$,
              label$:           self.label$,
              alwaysFloatLabel: self.alwaysFloatLabel,
              choices$:         self.choices$,
              placeholder$:     self.placeholder$,
              mode$:            self.mode$,
              size$:            self.size$,
              header$:          self.header$,
              disabledData$:    self.disabledData$
            })
              .attrs({name: self.name})
              .enableClass('selection-made', self.index$.map((index) => index !== -1))
            .end();
        }

        return text ? self.E().translate(text + '.name', text) : '';
      }));
    },

    function findIndexOfChoice(choice) {
      if ( ! choice ) return -1;
      var choices = this.choices;
      var data    = choice[0];
      for ( var i = 0 ; i < choices.length ; i++ ) {
        if ( foam.util.equals(choices[i][0], data) ) return i;
      }
      var text = choice[1];
      for ( var i = 0 ; i < choices.length ; i++ ) {
        if ( choices[i][1] === text ) return i;
      }
      return -1;
    },

    function findChoiceByData(data) {
      var choices = this.choices;
      for ( var i = 0 ; i < choices.length ; i++ ) {
        if ( foam.util.equals(choices[i][0], data) ) return choices[i];
      }
    },

    function findChoiceByText(text) {
      var choices = this.choices;
      for ( var i = 0 ; i < choices.length ; i++ ) {
        if ( choices[i][1] === text ) return choices[i];
      }
    },

    function fromProperty(p) {
      this.SUPER(p);
      this.prop_ = p;
      this.defaultValue = p.value;
      this.label = p.label || this.label || p.name;
    }
  ],

  listeners: [
    {
      name: 'onChoicesUpdate',
      isFramed: true,
      code: function() {
        var d = this.data;
        if ( this.choices.length ) {
          var choice = this.findChoiceByData(d);
          this.choice = choice === null ? this.findChoiceByData(this.defaultValue) : choice;
        }
      }
    },
    {
      name: 'onDAOUpdate',
      isMerged: true,
      mergeDelay: 160,
      on: [ 'this.propertyChange.mode' ],
      code: function() {
        var self = this;
        var seq = ++this.seq_;
        var dao = this.dao;
        if ( ! foam.dao.DAO.isInstance(this.dao) ) return;

        var of = this.dao.of
        if ( of._CHOICE_TEXT_ ) {
          dao.select(this.PROJECTION(of.ID, of._CHOICE_TEXT_)).then((s) => {
            if ( seq !== self.seq_ ) return; // stale select
            this.choices = s.projection;
          });
          return;
        }

        this.warn('Inefficient ChoiceView. Consider creating storage transient _choiceText_ property on ' + of.id + ' DAO, prop: ' + this.prop_);
        /* Ex.:
        {
          class: 'String',
          name: '_choiceText_',
          transient: true,
          javaGetter: 'return getName();',
          getter: function() { return this.name; }
        }
        */

        var p = this.mode === foam.u2.DisplayMode.RW ?
          dao.limit(350).select().then(s => s.array) :
          dao.find(this.data).then(o => o ? [o] : []);

        p.then(a => {
          if ( a.length > 100 ) {
            this.warn('Warning: Inefficient to use ChoiceView for large selections, consider using RichChoiceView instead. Count: ' + a.length);
            if ( this.prop_ ) {
              this.warn('For Property: ' + this.prop_.name + ' on ' + this.prop_.forClass_);
            }
          }
          var choices = a.map(this.objToChoice);
          var choiceLabels = a.map(o => {
            const v = this.objToChoice(o);
            if ( ! v ) {
              console.log(this.objToChoice.toString());
            }
            return this.objToChoice(o)[1];
          });
          Promise.all(choiceLabels).then(resolvedChoiceLabels => {
            if ( seq !== self.seq_ ) return; // stale select
            for ( let i = 0; i < choices.length; i++ ) {
              choices[i][1] = resolvedChoiceLabels[i];
            }
            this.choices = choices;
            if ( ! this.data && this.index === -1 ) this.index = this.placeholder && this.choices.length != 1 ? -1 : 0;
          });
        });
      }
    }
  ],
});
