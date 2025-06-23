/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ComparatorView',
  extends: 'foam.u2.View',

  requires: [
    'foam.u2.TextField'
  ],

  imports: [
    'objData'
  ],

  css: `
  `,

  properties: [
    {
      name: 'choices',
      view: function(_, X) {
        var of = X.objData.dao.of;
        var choices = [ '--' ];
        of.getAxiomsByClass(foam.lang.Property).forEach(p => {
          if ( p.hidden || p.networkTransient ) return;
          // instead of pushing [p, p.label] into choices, 
          // we're pushing `[ '-' + p.name, '-' + p.label]` because what gets shown in gui is '-id vs id',
          // '-' sign, it's being used to denote ordering, so pushing `[p, '-' + p.label]` does not preserve that behavior
          choices.push([p.name, p.label]);    
          choices.push(['-' + p.name, '-' + p.label]);
        });
        return { class: 'foam.u2.view.ChoiceView', choices: choices };
      },
      preSet: function(o, n) {
        if ( n == '--' ) return;
        if ( this.objData.order ) this.objData.order += ',';
        this.objData.order += n;
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
          startContext({data: this}).add(this.CHOICES).endContext();
    }
  ],

  listeners: [
  ],

});
