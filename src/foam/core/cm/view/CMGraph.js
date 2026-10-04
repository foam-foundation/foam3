/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.cm.view',
  name: 'CMGraph',
  extends: 'foam.u2.View',
  documentation: `
    The view model that renders result of a DatasetCM to the graph using ChartJs.
  `,

  css: `
    <<warming {
      display: grid;
      place-items: center;
      height: 100%;
    }
    <<plot {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
    }
    <<plot-item {
      width: 100%
    }
  `,

  requires: [
    'foam.graphics.Box',
    'org.chartjs.Line2',
    'org.chartjs.Bar2'
  ],

  imports: [
    'cmDAO'
  ],

  properties: [
    {
      class: 'Reference',
      of: 'foam.core.cm.CM',
      name: 'cmId',
      required: true,
      documentation:`
        Reference to the CM by Id.
      `
    },
    {
      class: 'String',
      name: 'type',
      documentation: 'type of graph.'
    },
    {
      class: 'Map',
      name: 'chartJsConfig',
      factory: function() {
        return {};
      },
    }
  ],
  methods: [
    async function render() {
      var self = this;

      let cm = await self.cmDAO.find(self.cmId);
      if ( !cm ) {
        self.addClass(self.myClass('warming'))
          .start('h4')
            .add(`🚫 CM: \`${self.cmId}\` not found.`)
          .end();
        return;
      }

      if ( !cm.enabled ) {
        self.addClass(self.myClass('warming'))
          .start('h4')
            .add(`🚫 CM: \`${self.cmId}\` is disabled.`)
          .end();
        return;
      }

      if ( !cm.labels || !cm.dataset || cm.labels.length === 0 ) {
        self.addClass(self.myClass('warming'))
          .start('h4')
            .add(`⏳ CM: \`${self.cmId}\` is waiting for execute`)
          .end();
        return;
      }
      
      let data = await self.buildChartDataSet(cm)
      let plots = await self.generatePlots(data)

      self.addClass(self.myClass('canvas-container'))
        .start('div').addClass(self.myClass('plot'))
          .forEach(plots, function(plot) {
            this.start('div').addClass(self.myClass('plot-item'))
              .add(plot)
            .end()
          })
        .end();
    },

    async function buildChartDataSet(cm) {
      let dataSets = {};
      dataSets['labels'] = cm.labels
      dataSets['datasets'] = []

      for (const [k, v] of Object.entries(cm.dataset)) {
        dataSets['datasets'].push({
          label: k,
          data: v.values,
          borderWidth: 1
        })
      }

      return dataSets
    },

    async function generatePlots(data) {
      return [
        this.Line2.create({
          data,
          options: {
            legend: {
              display: false,
            },
          }
        })
      ]
    }
  ]
})