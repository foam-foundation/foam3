/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PredicateView',
  extends: 'foam.u2.View',

  requires: [
    'foam.u2.tag.CircleIndicator',
    'foam.u2.TextField'
  ],

  imports: [
    'eval_',
    'objData'
  ],

  css: `
    ^ {
      cursor: pointer;
    }
    ^helper-icon svg { fill: currentColor; }
    ^helper-icon { vertical-align: sub; padding: 6px; }
  `,

  properties: [
    {
      name: 'choices',
      view: function(_, X) {
        var of = X.objData.dao.of;
        var choices = [ '--' ];
        of.getAxiomsByClass(foam.lang.Property).forEach(p => {
          if ( ! p.searchable && ( p.hidden || p.networkTransient ) ) return;
          if ( foam.lang.Boolean.isInstance(p) ) {
            // insted of pushing 
            // choices.push([p, 'is:'  + p.name]); 
            // we're pushing `[ 'is:' + p.name, 'is:' + p.label]`
            // reason provided in ComparatorView ~ same logic
            choices.push([ 'is:' + p.name, 'is:' + p.label]);
            choices.push([ '-is:' + p.name, '-is:' + p.label]);
          } else {
            choices.push([p.name, p.label]);
          }
        });
        return { class: 'foam.u2.view.ChoiceView', choices: choices, type: 'search' };
      },
      preSet: function(o, n) {
        if ( n == '--' ) return;
        if ( this.objData.where ) this.objData.where += ' ';
        this.objData.where += n;
        return '--';
      }
    }
  ],

  methods: [
    function render() {
      this.
        start('span').
          style({display: 'flex'}).
          tag(this.TextField, {data$: this.data$, size: 40, type: 'search'}).
          startContext({data: this}).add(this.CHOICES).endContext()
          // Commented for now until we find better way 
          // start(this.CircleIndicator, {glyph: 'helpIcon', size: 60}).
          //   addClass(this.myClass('helper-icon')).
          //   on('click', this.mqlHelp).
          // end();
    }
  ],

  listeners: [
    function mqlHelp() {
      this.eval_('helpMQL', true);
    }
  ],

});
