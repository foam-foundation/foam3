/**
 * @license
 * Copyright 2016 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Flow',

  implements: [
    'foam.core.auth.CreatedAware',
    'foam.core.auth.CreatedByAware',
    'foam.core.auth.LastModifiedAware',
    'foam.core.auth.LastModifiedByAware'
  ],

  imports: [ 'flowDAO' ],

  ids: [ 'name' ],
/*
  axioms: [
    {
      class: 'foam.comics.v2.CannedQuery',
      label: 'Public',
      predicateFactory: function(e, cls) { return e.EQ(cls.IS_PUBLIC, true); }
    },
    {
      class: 'foam.comics.v2.CannedQuery',
      label: 'Private',
      predicateFactory: function(e, cls) { return e.EQ(cls.IS_PUBLIC, false); }
    }
  ],
    */

  tableColumns: [ 'name', 'source', 'description', 'status', /* 'isPublic', 'readOnly', */ 'reflow' ],

  searchColumns: [ 'name', 'status', 'source' ],

  properties: [
    {
      class: 'String',
      name: 'name',
      onKey: true
    },
    {
      class: 'String',
      name: 'description',
      width: 80
    },
    {
      class: 'String',
      name: 'status',
      width: 20
    },
    {
      class: 'String',
      name: 'source',
      width: 30
    },
    {
      class: 'String',
      name: 'notes',
      width: 80,
      view: { class: 'foam.u2.tag.TextArea', rows: 4, cols: 78 }
    },
    {
      class: 'Boolean',
      name: 'isPublic',
      value: true
    },
    {
      class: 'Boolean',
      name: 'readOnly'
    },
    {
      name: 'lastModifiedByAgent',
      hidden: true
    },
    {
      name: 'createdByAgent',
      hidden: true
    },
    {
//      class: 'FObjectArray',
//      of: 'com.google.flow.Property',
      name: 'memento',
      hidden: true,
      transient: true,
      postSet: function(o, n) {
        if ( this.feedback_ ) return;
        this.feedback_ = true;
        console.log('*********** FLOW memento change: ', n);
        try {
          // TODO: should still not output empty reactions_: or children:
          var json = foam.json.Outputter.create({
            pretty: true,
            strict: true,
            formatDatesAsNumbers: false,
            outputDefaultValues: false,
            useShortNames: false,
            propertyPredicate: function(o, p) { return ! p.externalTransient && ! p.networkTransient; }
          });
//          this.mementoStr = foam.json.Short.stringify(n);
          this.mementoStr = json.stringify(n);
        } finally {
          this.feedback_ = false;
        }
      }
    },
    {
      class: 'String',
      name: 'mementoStr',
      label: 'JSON',
      postSet: function(o, n) {
        if ( this.feedback_ ) return;
        this.feedback_ = true;
        try {
          // console.log('*********** FLOW mementoStr change:', n);
          var json    = JSON.parse(n);
          var memento = this.memento = foam.json.parse(json, null, this.__context__);
          console.log('mementos:', memento.length);
        } finally {
          this.feedback_ = false;
        }
      },
      view: { class: 'foam.u2.tag.TextArea', rows: 10, cols: 78 }
    },
    {
      class: 'FObjectProperty',
      name: 'mementoMgr',
      transient: true,
      hidden: true,
      factory: function() {
        return foam.memento.MementoMgr.create({memento$: this.mementoStr$, position$: this.revision$});
      }
    },
    {
      class: 'Int',
      name: 'version'
    },
    {
      class: 'Int',
      name: 'revision',
      transient: true,
      xxxview: {
        class: 'foam.u2.view.DualView',
        viewa: { class: 'foam.u2.IntView' },
        viewb: { class: 'foam.u2.RangeView', onKey: true }
      }
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      this.mementoMgr;
    }
  ],

  actions: [
    {
      name: 'save',
      code: function() {
        // TODO: FIX
        // This is a hackish solution to the bug that the memento is saved before
        // the last block's name is set. Ideally the block would be named before
        // being added to the flowChildren. Alternatively, the mementoStr could never
        // be created until just before you save, but updating it for every update
        // will make it easy to implement undo/redo in the future.
        this.MEMENTO.postSet.call(this, this.menento, this.memento);
        this.version++;
        this.mementoMgr.clear();
        this.flowDAO.put(this);
      },
      isEnabled: function(name, revision) { return name && name !== 'Unnamed' && revision; },
      isAvailable: function() {
        // Enable in Reflow, but disable in DAOController (because DAOController already has save feature)
        return this.__context__.flow;
      }
    },
    {
      name: 'reflow',
      code: function(X) {
        X.routeTo('reflow/' + this.name + '?flowMode=view');
      },
      isAvailable: function() {
        // Disable in Reflow, but enable in DAOController (because already in reflow)
        return ! this.__context__.flow;
      }
    }
  ]
});
