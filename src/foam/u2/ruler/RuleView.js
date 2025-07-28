/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.ruler',
  name: 'RuleView',
  extends: 'foam.u2.View',

  imports: [
    'openInSideView?'
  ],

  requires: [
    'foam.u2.ruler.ExprView'
  ],

  css: `
    ^ {
      border: solid 0.1rem;
      border-color: #CCC;
    }
    ^name {
      line-height: 2.5rem;
    }
    ^predicate {
      display: flex;
    }
  `,

  methods: [
    function render () {
      console.log('predicate', this.data?.predicate?.toString(), this.data?.predicate)
      this
        .on('click', () => {
          if ( ! this.openInSideView ) return;
          this.openInSideView(this.data);
        })
        .addClass()
        .start()
          .addClass(this.myClass('name'))
          .add(this.data.name)
        .end()
        .start()
          .addClass(this.myClass('predicate'))
          .tag(this.ExprView, {
            of: this.data.predicate.cls_,
            data: this.data.predicate
          })
        .end()
    }
  ]
});
