/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.history',
  name: 'HistoryView',
  extends: 'foam.u2.View',
  requires: [
    'foam.dao.history.HistoryRecord',
    'foam.u2.history.HistoryItemView',
  ],

  implements: [ 'foam.mlang.Expressions' ],

  documentation: 'View displaying history',

  css: `
    << {
      height: 370px;
      background: $backgroundDefault;
      position: relative;
      vertical-align: top;
      border-radius: 2px;
      overflow: auto;
      padding-left: 20px;
      padding-right: 20px;
      z-index: 0;
    }
    << h2 {
      height: 20px;
      opacity: 0.6;
      text-align: left;
      color: $textDefault;
    }
    << .timelineRecord {
      position: relative;
    }
    << .timeline {
      width: 2px;
      height: 100%;
      background: $backgroundInverseTertiary;
      position: absolute;
      left: 23px;
      top: 5px;
      z-index: -1;
      margin-bottom: 20px;
      content: '';
    }
    << > div:last-of-type .timeline {
      display: none;
    }
  `,

  properties: [
    'data',
    'historyItemView',
    { class: 'String', name: 'title', value: 'History' }
  ],

  methods: [
    function render() {
      var view = this;

      this
        .addClass('p-legal-light', this.myClass())
        .start('h2').addClass('title-light').add(this.title).end()
        .select(view.data.orderBy(this.DESC(this.HistoryRecord.TIMESTAMP)), function(record) {
          return this.E().start('div')
            .addClass('timelineRecord')
            .start('div').addClass('timeline').end()
            .call(function() {
              view.historyItemView.outputRecord(this, record)
            })
          .end();
        });
    }
  ]
});
