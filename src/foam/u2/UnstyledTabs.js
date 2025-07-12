/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'UnstyledTabs',
  extends: 'foam.u2.Element',
  mixins: ['foam.u2.memento.Memorable'],

  documentation: 'An unstyled tab.',
  requires: [ 'foam.u2.Tab' ],

  properties: [
    {
      name: 'selected',
      postSet: function(o, n) {
        if ( o ) o.selected = false;
        n.selected = true;
        this.selectedLabel = n.mementoLabel;
      }
    },
    'tabRow',
    {
      name: 'updateMemento',
      class: 'Boolean'
    },
    {
      name: 'selectedLabel',
      memorable: true
    },
    {
      class: 'Int',
      name: 'mementoCounter_',
      documentation: 'Used to set default memento value for tabs'
    }
  ],

  methods: [
    function init() {
      this.selectedLabel$.sub(this.maybeResetMemento);
      this.
        addClass(this.myClass()).
        start('div', null, this.tabRow$).
          addClass(this.myClass('tabRow')).
        end().
        start('div', null, this.content$).
          addClass(this.myClass('content')).
        end();
    },

    function add(tab) {
      if ( this.Tab.isInstance(tab) ) {
        var self = this;
        if ( ! tab.mementoLabel ) {
          tab.mementoLabel = this.mementoCounter_++;
        }
        if ( ! this.selected && ! this.selectedLabel ) this.selected = tab;
        if ( tab.selected || this.selectedLabel == tab.mementoLabel )
          this.selected = tab;

        this.tabRow.start('span').
          addClass(this.myClass('tab')).
          enableClass('selected', tab.selected$).
          on('click', function() {
            this.selected = tab;
          }.bind(this)).
          add(tab.slot(function(label) {
            if ( foam.String.isInstance(label) ) return label;
            return self.createChild_(label, {});
          })).
        end();

        tab.shown$ = tab.selected$;
      }

      this.SUPER(tab);
    }
  ],
  listeners: [
    function maybeResetMemento() {
      if ( ! this.selectedLabel ) return;
      this.memento_ && this.memento_.removeMementoTail();
    }
  ]
});
