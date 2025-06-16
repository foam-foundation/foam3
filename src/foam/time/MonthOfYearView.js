/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.time',
  name: 'MonthOfYearView',
  extends: 'foam.u2.view.MultiChoiceView',

  requires: [
    'foam.time.MonthOfYear'
  ],

  css: `
    ^flexer > div {
      width: fit-content !important;
    }
    ^flexer {
      display: flex;
      flex-wrap: wrap;
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
      value: 12
    },
    {
      name: 'showMinMaxHelper',
      value: false
    },
    {
      name: 'numberColumns',
      value: 12
    }
  ],
  methods: [
    function init() {
      this.SUPER();
      this.choices = this.MonthOfYear.VALUES.map(v => [v, v.shortName]);
    }
  ]
});
