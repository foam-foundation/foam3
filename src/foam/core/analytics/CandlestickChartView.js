/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.analytics',
  name: 'CandlestickChartView',
  extends: 'foam.u2.Element',

  documentation: 'A chart which shows candlestick dao data as line graph.  Supports showing two candlesticks. It is expected they share a common close value times.',
  
  implements: [ 'foam.mlang.Expressions' ],
  mixins: [ 'foam.u2.Router' ],

  requires: [
    'foam.dao.ArrayDAO',
    'foam.dao.FilteredDAO',
    'foam.graphics.Box',
    'foam.graphics.Label',
    'foam.log.LogLevel',
    'foam.core.analytics.Candlestick',
    'foam.core.analytics.CandlestickUniqueKeyPredicate',
    'org.chartjs.Line2'
  ],

  imports: [
    'notify'
  ],
  
  messages: [
    {
      name: 'VIEW_HEADER',
      message: 'Candlestick Charting'
    },
    {
      name: 'REFRESH_REQUESTED',
      message: 'Refresh requested'
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'viewTitle',
      factory: function() {
        return this.VIEW_HEADER;
      }
    },
    {
      documentation: `The Candlestick DAO to graph.`,
      class: 'Reference',
      of: 'foam.core.boot.CSpec',
      label: 'Candlestick DAO',
      name: 'candlestickDAOKey',
      memorable: true,
      targetDAOKey: 'AuthenticatedCSpecDAO',
      view: function(_, X) {
        var E = foam.mlang.Expressions.create();
        return {
          class: 'foam.u2.view.RichChoiceView',
          search: true,
          sections: [
            {
              heading: 'DAO',
              dao: X.AuthenticatedCSpecDAO
                .where(E.AND(
                  E.EQ(foam.core.boot.CSpec.SERVE, true),
                  E.OR(
                    E.CONTAINS_IC(foam.core.boot.CSpec.NAME, "candlestick"),
                    E.IN(foam.core.boot.CSpec.NAME, [
                      'com1MinuteDAO',
                      'com5MinuteDAO',
                      'comHourlyDAO',
                      'comDailyDAO',
                      'om1MinuteDAO',
                      'om5MinuteDAO',
                      'omHourlyDAO',
                      'omDailyDAO',
                      'pm1MinuteDAO',
                      'pmHourlyDAO',
                      'pmDailyDAO'
                    ])
                  ),
                  E.NOT(E.EQ(foam.core.boot.CSpec.NAME, "candlestickAlarmDAO"))
                ))
                .orderBy(foam.core.boot.CSpec.NAME)
            }
          ]
        };
      },
      postSet: function(oldValue, newValue) {
        this.rebuild();
      }
    },
    {
      documentation: 'Key for first Line dataset.',
      name: 'candlestickKey1',
      class: 'String',
      memorable: true,
      view: function(_, X) {
        var dao = X.data.slot(function(candlestickDAOKey) {
          if ( candlestickDAOKey ) {
            return this.FilteredDAO.create({
              delegate: ctrl.__subContext__[candlestickDAOKey].
                orderBy(this.Candlestick.KEY),
              predicate: this.CandlestickUniqueKeyPredicate.create()
            });
          }
          return this.ArrayDAO.create();
        });
        // RichChoiceView not setup correctly. Search not showing anything
        // and selection shows as a 'summary' view. 
        // return {
        //   class: 'foam.u2.view.RichChoiceView',
        //   search: true,
        //   sections: [
        //     {
        //       heading: 'Events',
        //       dao$: dao
        //     }
        //   ],
        //   allowClearingSelection: true,
        //   rowView: {
        //     class: 'foam.core.analytics.CandlestickKeyView'
        //   }
        // }
        return foam.u2.view.ChoiceView.create({
          objToChoice: function(candlestick) {
            return [candlestick.key, candlestick.key];
          },
          dao$: dao,
          placeholder: '--'
        });
      },
      postSet: function(oldValue, newValue) {
        this.rebuild();
      }
    },
    {
      documentation: 'Key for second Line dataset.',
      name: 'candlestickKey2',
      class: 'String',
      memorable: true,
      view: function(_, X) {
        var dao = X.data.slot(function(candlestickDAOKey) {
          if ( candlestickDAOKey ) {
            return this.FilteredDAO.create({
              delegate: ctrl.__subContext__[candlestickDAOKey].
                orderBy(this.Candlestick.KEY),
              predicate: this.CandlestickUniqueKeyPredicate.create()
            });
          }
          return this.ArrayDAO.create();
        });
        return foam.u2.view.ChoiceView.create({
          objToChoice: function(candlestick) {
            return [candlestick.key, candlestick.key];
          },
          dao$: dao,
          placeholder: '--'
        });
      },
       postSet: function(oldValue, newValue) {
        this.rebuild();
      }
    },
    {
      documentation: 'Key for third Line dataset.',
      name: 'candlestickKey3',
      class: 'String',
      memorable: true,
      view: function(_, X) {
        var dao = X.data.slot(function(candlestickDAOKey) {
          if ( candlestickDAOKey ) {
            return this.FilteredDAO.create({
              delegate: ctrl.__subContext__[candlestickDAOKey].
                orderBy(this.Candlestick.KEY),
              predicate: this.CandlestickUniqueKeyPredicate.create()
            });
          }
          return this.ArrayDAO.create();
        });
        return foam.u2.view.ChoiceView.create({
          objToChoice: function(candlestick) {
            return [candlestick.key, candlestick.key];
          },
          dao$: dao,
          placeholder: '--'
        });
      },
       postSet: function(oldValue, newValue) {
        this.rebuild();
      }
    },
    {
      name: 'canvas',
      factory: function() {
        return this.Box.create({
          width: 1200,
          height: 600
        });
      },
      visibility: 'RO',
      memorable: false
    },
    {
      name: 'chart',
      class: 'FObjectProperty',
      of: 'foam.graphics.CView',
      visibility: 'HIDDEN'
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      this.addCrumb();
      this.onDetach(this.stack?.setTitle(this.viewTitle$, this));
    },

    async function render() {
      this.SUPER();
      
      this.buildChartData().then(function(data) {
        this.chart = this.Line2.create({
          data: data,
          options: {
            legend: {
              display: false,
            },
            tooltips: {
              // see: https://github.com/chartjs/Chart.js/issues/3953
              callbacks: {
                label: function(tooltipItem, data) {
                  var dataset = data.datasets[tooltipItem.datasetIndex];
                  var index = tooltipItem.index;
                  return dataset.labels[index] + ': ' + dataset.data[index];
                }
              }
            }
          }
        });
        this.canvas.add(this.chart);
      }.bind(this));

      this.addClass(this.myClass());
      this
        .start(this.Cols).addClass(this.myClass('header'))
        .startContext({data: this})
        .start().addClass(this.myClass('title'))
        .add(this.VIEW_HEADER)
        .tag(this.REFRESH, {
          buttonStyle: foam.u2.ButtonStyle.TERTIARY,
          icon: 'images/refresh-icon-black.svg',
          label: '',
        })
        .end()
        .endContext()
        .end();

      this
        .start(this.Cols).addClass(this.myClass('container-selectors'))
        .startContext({data: this})
        .start().addClass(this.myClass('selector'))
        .add(this.CANDLESTICK_DAOKEY.__)
        .add(this.CANDLESTICK_KEY1.__)
        .add(this.CANDLESTICK_KEY2.__)
        .add(this.CANDLESTICK_KEY3.__)
        .end()
        .endContext()
        .end();

      this.
        start('div', null, this.canvasContainer$).addClass(this.myClass('canvas-container')).
        add(this.canvas).
        end();
    },

    /**
       Multi-line with seperate labels setup
       see: https://github.com/chartjs/Chart.js/issues/3953
     */
    async function buildChartData() {
      var labels = new Map();
      var datasets = new Map();

      if ( this.candlestickDAOKey &&
           ( this.candlestickKey1 ||
             this.candlestickKey2 ||
             this.candlestickKey3 ) ) {
        var dao = ctrl.__subContext__[this.candlestickDAOKey];
        dao = dao.where(this.OR(
          this.EQ(this.Candlestick.KEY, this.candlestickKey1 || ''),
          this.EQ(this.Candlestick.KEY, this.candlestickKey2 || ''),
          this.EQ(this.Candlestick.KEY, this.candlestickKey3 || '')
        ));
        dao = dao.orderBy(this.Candlestick.CLOSE_VALUE_TIME);

        let sink = await dao.select();
        let arr = sink.array;
        for ( let i = 0; i < arr.length; i++ ) {
          let c = arr[i];
          if ( i == 0 ) {
            labels.set(c.closeValueTime.getTime(), c.closeValueTime);
          }
          var dataset = datasets.get(c.key);
          if ( ! dataset ) {
            dataset = {
              label: c.key,
              data: [],
              labels: [],
              fill: false,
              borderColor: 'hsl('+(359/(i+1))+',100%,50%)',
              tension: 0.1
            }
            datasets.set(c.key, dataset);
          }
          var data = dataset['data'];
          data.push(c.total);
          var labels = dataset['labels'];
          labels.push(c.closeValueTime);
        }
      }

      let config = {
        labels: [...labels.values()].sort(),
        datasets: [...datasets.values()]
      };

      return config;
    },

    function rebuild() {
      this.buildChartData().then(function(data) {
        if ( this.chart ) this.chart.data = data;
      }.bind(this));
    }
  ],

  actions: [
    {
      name: 'refresh',
      toolTip: 'Refresh',
      icon: 'images/refresh-icon-black.svg',
      isAvailable: function(candlestickDAOKey) {
        return !! candlestickDAOKey;
      },
      code: function(X) {
        X.notify(X.data.REFRESH_REQUESTED, '', X.data.LogLevel.INFO);
        X.data.rebuild();
      }
    }
  ]
});
