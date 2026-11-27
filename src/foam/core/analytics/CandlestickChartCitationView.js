/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.analytics',
  name: 'CandlestickChartCitationView',
  extends: 'foam.core.analytics.CandlestickChartView',

  documentation: 'Use to show Chart in dashboard Card',

  properties: [
    {
      class: 'Class',
      of: 'foam.core.analytics.Candlestick'
    }
    // populate dao, and keys in menus.jrl
  ],

  methods: [
    async function render() {
      var self = this;

      this.rebuild();

      this.
        start('div', null, this.canvasContainer$).addClass(this.myClass('canvas-container')).
        start('div').addClass(this.myClass('chart')).add(this.chart).end().
        end();
    }
  ]
})
