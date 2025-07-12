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
    'foam.u2.TextField'
  ],

  imports: [
    'eval_',
    'objData'
  ],

  css: `
    ^ {
      display: flex;
      align-items: center;
      gap: 8px;
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
            choices.push([ 'is:' + p.name, 'is:' + p.name]);
            choices.push([ '-is:' + p.name, '-is:' + p.name]);
          } else {
            choices.push([p.name, p.name]);
          }
        });
        return { class: 'foam.u2.view.ChoiceIconView', choices: choices, type: 'search', themeIcon: 'plus' };
      },
      preSet: function(o, n) {
        if ( n == '--' ) return;
        if ( this.objData.where ) this.objData.where += ' ';
        this.objData.where += n;
        return '--';
      }
    }
  ],

  // Glyphs can be found at `foam3/src/foam/u2/theme/ThemeGlyphs.js`
  methods: [
    function render() {
      this.
        addClass().
        tag(this.TextField, {data$: this.data$, size: 40, type: 'search'}).
        startContext({data: this}).add(this.CHOICES).endContext();
    }
  ],

  listeners: [
    function mqlHelp() {
      this.eval_('helpMQL', true);
    }
  ]

});
