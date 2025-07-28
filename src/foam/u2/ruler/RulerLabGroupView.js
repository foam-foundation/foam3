/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.ruler',
  name: 'RulerLabGroupView',
  extends: 'foam.u2.View',
  implements: ['foam.mlang.Expressions'],

  css: `
    ^ {
      --color: $primary400;
    }
    ^heading {
      background-color: var(--color);
      padding: 0 0.8rem;
      color: #FFF;
    }

    ^border {
      border: 0.2rem solid  var(--color);
      padding: 0.8rem;
    }
  
    ^list.foam-u2-DAOList{
      height: auto;
      gap: 0.8rem;
    }
    ^list.foam-u2-DAOList > .foam-u2-DAOList-wrapper {
      overscroll-behaviour-y: auto;
    }
  `,

  requires: [
    'foam.core.ruler.Rule',
    'foam.u2.DAOList',
  ],

  properties: [
    {
      class: 'foam.dao.DAOProperty',
      name: 'dao'
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'groupFilterRuleDAO',
      expression: function (dao, data) {
        return dao.where(this.EQ(this.Rule.RULE_GROUP, this.data));
      }
    },
    { name: 'shouldShow', class: 'Boolean' },
    'color'
  ],

  methods: [
    function render () {
      if (this.color )
        this.el().then(el => el?.style.setProperty('--color', this.color ))
      this.computeShow();
      this
        .addClass()
        .show(this.shouldShow$)
        .start()
          .addClass('h500', this.myClass('heading'))
          .add(this.data$.dot('id'))
        .end()
        .start()
          .addClass(this.myClass('border'))
          .start(this.DAOList, {
            data$: this.groupFilterRuleDAO$,
            rowView: {
              class: 'foam.u2.ruler.RuleView'
            }
          })
            .addClass(this.myClass('list'))
          .end()
        .end()
    }
  ],
  listeners: [
    {
      name: 'computeShow',
      on: ['this.propertyChange.groupFilterRuleDAO'],
      code: function() {
        this.groupFilterRuleDAO.select(this.COUNT()).then(v => this.shouldShow = !! v.value);
      }
    }
  ]
});
