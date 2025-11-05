/**
* @license
* Copyright 2019 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'org.chartjs',
  name: 'AbstractChartView',
  extends: 'foam.u2.View',
  flags: ['web'],

  requires: [
    'foam.dao.FnSink',
    'org.chartjs.ChartCView'
  ],

  properties: [
    {
      class: 'foam.dao.DAOProperty',
      name: 'data'
    },
    {
      class: 'Map',
      name: 'config',
      preSet: function(_, n) {
        // We do the responsiveness so don't rely on chartjs.
        n.options.responsive = false;
        return n;
      }
    },
    {
      name: 'parentEl_',
    },
    {
      name: 'chart_'
    }
  ],

  methods: [
    async function init() {
      if ( ! this.parentEl_ ) return null;
      var el = await this.parentEl_.el_();
      this.chart_ = this.ChartCView.create({
        config$: this.config$,
        height: el.clientHeight,
        width: el.clientWidth
      });
    },

    function render() {
      this.onDetach(this.data$proxy.listen(this.FnSink.create({ fn: this.dataUpdate })));
      this.dataUpdate();
      window.addEventListener('resize', this.onResize);
      this
        .start('div', null, this.parentEl_$)
          .style({
            width: '100%',
            height: '100%'
          })
          .add(this.chart_$)
        .end();
    }
  ],

  reactions: [
    ['parentEl_', 'onload', 'onResize']
  ],

  listeners: [
    {
      name: 'onResize',
      isFramed: true,
      code: function() {
        this.chart_ = undefined;
      }
    },
    {
      name: 'dataUpdate',
      isFramed: true,
      code: function() {
        // Template function.
      }
    }
  ]
});
