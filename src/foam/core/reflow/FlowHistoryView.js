/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowHistoryView',
  extends: 'foam.u2.View',

  requires: [
    'foam.dao.FnSink',
    'foam.u2.history.DiffHistoryItemView'
  ],

  imports: [ 'flowDAO?' ],

  documentation: `Lists a Flow's history records, newest first, each rendered
    by DiffHistoryItemView. History is written server-side by the flowDAO
    rule and the client flowHistoryDAO never sees those puts, so the list
    reloads when this flow is saved through the client flowDAO.`,

  messages: [
    { name: 'NO_HISTORY', message: 'No history available.' }
  ],

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px 0;
    }
    ^empty {
      padding: 16px;
      color: $textSecondary;
      text-align: center;
      border: 1px dashed $borderDefault;
      border-radius: 6px;
    }
  `,

  properties: [
    'data',
    {
      class: 'String',
      name: 'flowName',
      documentation: 'Flow whose saves reload the list.'
    },
    {
      name: 'itemView',
      factory: function() { return this.DiffHistoryItemView.create({}, this); }
    },
    {
      name: 'records_',
      documentation: 'Rows from the last select; unset until it resolves.'
    },
    {
      class: 'Int',
      name: 'batch_',
      documentation: 'Lets a stale in-flight select drop its result.'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;
      this.addClass();

      if ( ! this.data ) {
        this.renderEmpty(this);
        return;
      }

      if ( this.flowDAO ) {
        this.onDetach(this.flowDAO.listen(this.FnSink.create({ fn: function(op, obj) {
          if ( obj && obj.name === self.flowName ) self.load_();
        } })));
      }
      this.load_();

      this.dynamic(function(records_) {
        if ( ! records_ ) return;
        if ( ! records_.length ) {
          self.renderEmpty(this);
          return;
        }
        records_.forEach(record => self.itemView.outputRecord(this, record));
      });
    },

    function renderEmpty(parent) {
      parent.start('div').addClass(this.myClass('empty')).add(this.NO_HISTORY).end();
    }
  ],

  listeners: [
    {
      name: 'load_',
      isFramed: true,
      code: function() {
        var batch = ++this.batch_;
        this.data.select().then(sink => {
          if ( this.isDetached() || batch !== this.batch_ ) return;
          this.records_ = sink.array;
        });
      }
    }
  ]
});
