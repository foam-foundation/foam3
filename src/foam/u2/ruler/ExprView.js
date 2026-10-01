/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.ruler',
  name: 'ExprViewCSS',

  css: `
    ^operand {
      height: 2.5rem;
      line-height: 2.5rem;
      padding: 0 0.5rem;
      background-color: $backgroundInverseTertiary;
    }

    ^operator {
      display: flex;
      align-items: center;
      padding: 0 0.5rem;
      font-weight: $font-medium;
    }
    ^border {
      border: solid 0.2rem;
      border-color: $backgroundDefault;
    }
    ^operator-And {
      background-color: $purple200;
    }
    ^border-And {
      border-color: $purple200;
    }
    ^operator-Lt, ^operator-Eq {
      background-color: $green200;
    }
    ^border-Lt, ^border-Eq {
      border-color: $green200;
    }
    ^operator-Not {
      background-color: $red200;
    }
    ^border-Not {
      border-color: $red200;
    }
  `
})
foam.CLASS({
  package: 'foam.u2.ruler',
  name: 'ExprView',
  extends: 'foam.u2.View',
  mixins: ['foam.u2.ruler.ExprViewCSS'],

  axioms: [
    foam.pattern.Faceted.create({ inherit: true })
  ],

  methods: [
    function render () {
      this
        .addClass()
        .addClass(this.myClass('operand'))
        .add(this.data$.map(data => '' + data?.toString() ?? 'null'))
    }
  ]
});

foam.CLASS({
  package: 'foam.mlang',
  name: 'ContextObjectExprView',
  extends: 'foam.u2.View',
  mixins: ['foam.u2.ruler.ExprViewCSS'],

  css: `
    ^ {
      display: flex;
    }
    ^operand^ctx {
      background-color: $backgroundInverse;
      color: $grey100;
      font-weight: $font-medium;
    }
    ^operand^key {
      background-color: $backgroundInverseSecondary;
      color: $grey100;
      font-weight: $font-medium;
    }
  `,

  methods: [
    function render () {
      this
        .addClass()
        .start()
          .addClass(this.myClass('operand'))
          .addClass(this.myClass('ctx'))
          .add('X')
        .end()
        .start()
          .addClass(this.myClass('operand'))
          .addClass(this.myClass('key'))
          .add(this.data.key)
        .end()
    }
  ]
})

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'NaryExprView',
  extends: 'foam.u2.View',
  mixins: ['foam.u2.ruler.ExprViewCSS'],

  requires: [
    'foam.u2.ruler.ExprView'
  ],

  css: `
    ^ {
      display: flex;
      background-color: none;
    }
  `,

  methods: [
    function render () {
      this
        .addClass()
        .addClass(this.myClass('border'))
        .addClass(this.myClass('border-' + this.data.cls_.name))
        .forEach(this.data.args, function (arg, i) {
          this
            .callIf(i != 0, function () {
              this
                .start()
                  .addClass(this.myClass('operator'))
                  .addClass(this.myClass('operator-' + this.data.cls_.name))
                  .add(this.data.cls_.name)
                .end();
            })
            .tag(this.ExprView, {
              of: arg?.cls_,
              data: arg
            })
        })
    }
  ]
})

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'BinaryExprView',
  extends: 'foam.u2.View',
  mixins: ['foam.u2.ruler.ExprViewCSS'],

  requires: [
    'foam.u2.ruler.ExprView'
  ],

  css: `
    ^ {
      display: flex;
      background-color: none;
    }
  `,

  methods: [
    function render () {
      this
        .addClass()
        .addClass(this.myClass('border'))
        .addClass(this.myClass('border-' + this.data.cls_.name))
        .tag(this.ExprView, {
          of: this.data.arg1?.cls_,
          data: this.data.arg1
        })
        .start()
          .addClass(this.myClass('operator'))
          .addClass(this.myClass('operator-' + this.data.cls_.name))
          .add(this.data.cls_.name)
        .end()
        .tag(this.ExprView, {
          of: this.data.arg2?.cls_,
          data: this.data.arg2
        })
    }
  ]
})

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'NotExprView',
  extends: 'foam.u2.View',
  mixins: ['foam.u2.ruler.ExprViewCSS'],

  requires: [
    'foam.u2.ruler.ExprView'
  ],

  css: `
    ^ {
      display: flex;
      background-color: none;
    }
  `,

  methods: [
    function render () {
      this
        .addClass()
        .addClass(this.myClass('border'))
        .addClass(this.myClass('border-' + this.data.cls_.name))
        .start()
          .addClass(this.myClass('operator'))
          .addClass(this.myClass('operator-' + this.data.cls_.name))
          .add(this.data.cls_.name)
        .end()
        .tag(this.ExprView, {
          of: this.data.arg1?.cls_,
          data: this.data.arg1
        })
    }
  ]
})

foam.CLASS({
  package: 'foam.mlang.expr',
  name: 'DotExprView',
  extends: 'foam.u2.View',
  mixins: ['foam.u2.ruler.ExprViewCSS'],

  requires: [
    'foam.u2.ruler.ExprView'
  ],

  css: `
    ^ {
      display: flex;
      background-color: none;
    }
  `,

  methods: [
    function render () {
      this
        .addClass()
        .tag(this.ExprView, {
          of: this.data.arg1?.cls_,
          data: this.data.arg1
        })
        .tag(this.ExprView, {
          of: this.data.arg2?.cls_,
          data: this.data.arg2
        })
    }
  ]
})
