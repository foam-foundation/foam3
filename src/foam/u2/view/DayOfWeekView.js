/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.u2.view',
  name: 'DayOfWeekView',
  extends: 'foam.u2.view.MultiChoiceView',

  requires: [
    'foam.time.DayOfWeek'
  ],

  css: `
    ^flexer {
      display: flex;
      flex-wrap: wrap;
      width: 100%;
    }
  `,

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'choiceView',
      value: { class: 'foam.u2.view.DayChoiceView' }
    },
    {
      name: 'maxSelected',
      value: 7
    },
    {
      name: 'showMinMaxHelper',
      value: false
    },
    {
      name: 'numberColumns',
      value: 7
    }
  ],
  methods: [
    function init() {
      this.SUPER();
      this.choices = this.DayOfWeek.VALUES.map(v => [v, v.shortName]);
    }
  ]
});
