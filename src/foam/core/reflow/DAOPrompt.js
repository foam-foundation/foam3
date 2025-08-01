/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// TODO:
// MQL help
// orderBy, property help

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DAOPromptView',
  extends: 'foam.u2.View',

  css: `
  `,

  properties: [ { class: 'Long', name: 'version' } ],

  methods: [
    function render() {
      var self = this;

      // TODO: Temporary while detailview is hidden (or make into a Controller instead)
      this.data.where$.sub(this.rerun);

      this.data.skip$.sub(this.onUpdate);
      this.data.version$.sub(this.onUpdate);

      this.
        addClass().
        show(this.data.visible$).
        start('h3').
          add(self.data.label$).
        end().
        br().
        start().
          add(self.dynamic(async function(version) {
            var startTime = Date.now();
            // Clone is needed in case the select was loaded from a DAO and doesnt' have correct context.
            // TODO: fix JSON parsing should setup context correctly
            var select    = self.data.select.clone(self.data.__subContext__);
            await select.execute(this);
            self.data.readyLatch_.resolve();
            self.data.executionTime = foam.lang.Duration.duration(Date.now() - startTime);
          })).
        end();
    }
  ],

  listeners: [
    {
      name: 'onUpdate',
      isIdled: true,
      delay: 150,
      code: function() {
        // Used to avoid excessive number of updates, especially on slower connections
        this.version++;
      }
    },
    function copyToClipboard() {
      var range = document.createRange();
      range.selectNode(this.content.element_);
      window.getSelection().empty();
      window.getSelection().addRange(range);
    },
    {
      name: 'rerun',
      isMerged: true,
      delay: 500,
      code: function() {
        console.log('rerun', this.data.where);
        this.data.run();
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'DAOPrompt',

  sections: [
    {
      name: 'general',
      title: 'General'
    },
    {
      name: 'output',
      title: 'Output',
      collapsable: false
    },
    {
      name: 'scroll',
      title: 'Scroll',
      collapsable: false
    },
    {
      name: 'filter',
      title: 'Filter',
      collapsable: false
    },
    {
      name: 'actions',
      title: ''
    }
  ],

  implements: [
    'foam.mlang.Expressions'
  ],

  requires: [
    'foam.core.reflow.TableDAOAgent',
    'foam.core.reflow.DAOPromptView',
    'foam.parse.QueryParser'
  ],

  imports: [ 'block', 'eval_', 'scope' ],

  exports: [
    'dao',
    'limitedDAO as sinkDAO',
    'filteredDAO as sinkUnlimitedDAO',
    'columnStorage'
  ],

  properties: [
    {
      class: 'String',
      name: 'label',
      section: 'general',
      label: 'Name',
      onKey: true,
      factory: function() {
        return this.dao.of.model_.plural;
      },
      displayWidth: 60
    },
    {
      class: 'Boolean',
      name: 'visible',
      section: 'general',
      label: 'Visible',
      value: true,
      view: { class: 'foam.u2.Switch' }
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'dao',
      section: 'general',
      hidden: true,
      transient: true,
      adapt: function(o, n, p) {
        let oldAdapt = foam.dao.DAOProperty.ADAPT;
        if ( foam.String.isInstance(n) ) {
          if ( this.scope[n] ) {
            this.daoKey = n;
            n = this.scope[n];
          } else if ( this.scope[n + 'DAO'] ) {
            this.daoKey = n + 'DAO';
            n = this.scope[n + 'DAO'];
          } else if ( this.__context__[n + 'DAO'] ) {
            n =  n + 'DAO';
          } else if ( n.endsWith('s') ) {
            this.daoKey = n;
            n = n.substring(0, n.length-1) + 'DAO';
          }
        }
        return oldAdapt.value.call(this, o, n, p);
      }
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'limitedDAO',
      section: 'general',
      hidden: true,
      transient: true,
      expression: function(skip, limit, filteredDAO) {
        if ( ! filteredDAO ) return null;
        if ( limit ) filteredDAO = filteredDAO.limit(limit);
        if ( skip  ) filteredDAO = filteredDAO.skip(skip);
        return filteredDAO;
      }
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'filteredDAO',
      section: 'general',
      hidden: true,
      transient: true,
      expression: function(dao, where, order) {
        if ( ! dao ) return null;
        // Compiled on the Server
        // if ( this.where ) dao = dao.where(this.MQL(this.where));

        // Version which compiles on the Client
        if ( where ) {
          var p = this.QueryParser.create({of: dao.of}).parseString(where);
          dao = dao.where(p);
          // TODO: display syntax error if didn't parse
        }

        if ( order ) {
          // TODO: Move this logic somewhere more reusable (to QueryParser maybe?)
          // QueryParser already knows how to find properties using either the name, shortName, or alias, case-insensitive
          // So just reuse it.
          // TODO: Use PropertyNameParser instead
          var parser = this.QueryParser.create({of: dao.of});

          var c = null; // created compartor
          var s = '';
          order.trim().split(',').reverse().forEach(n => {
            n = n.trim();
            var desc = n.startsWith('-');
            if ( desc ) n = n.substring(1);
            var prop = parser.parseString(n, 'fieldname');
            if ( prop ) {
              if ( s ) s = ',' + s;
              s = prop.name + s;
              if ( desc ) s = '-' + s;
              if ( desc ) prop = this.DESC(prop);
              c = c ? this.THEN_BY(prop, c) : prop;
            }
          });
          if ( c ) dao = dao.orderBy(c);
        }

        return dao;
      }
    },
    {
      class: 'Int',
      name: 'skip',
      label: 'Skip',
      section: 'scroll',
      view: function(_, X) {
        return {
          class: 'foam.u2.view.DualView',
          viewa: { class: 'foam.u2.IntView' },
          viewb: { class: 'foam.u2.RangeView', minValue: 0, maxValue$: X.data.rowCount$.map(c => c-1), onKey: true }
        };
      },
      visibility: function(select) {
        // Show skip/limit only for sink agents (agents with getSink method like CSVDAOAgent, JSONDAOAgent)
        // Hide for non-sink agents (agents without getSink method like TableDAOAgent)
        if ( ! select ) return foam.u2.DisplayMode.HIDDEN;
        var isSinkAgent = foam.core.reflow.AbstractSinkDAOAgent.isInstance(select);
        return isSinkAgent ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'Int',
      name: 'limit',
      section: 'scroll',
      value: 100,
      placeholder: '',
      displayWidth: 8,
      visibility: function(select) {
        // Show skip/limit only for sink agents (agents with getSink method like CSVDAOAgent, JSONDAOAgent)
        // Hide for non-sink agents (agents without getSink method like TableDAOAgent)
        if ( ! select ) return foam.u2.DisplayMode.HIDDEN;
        var isSinkAgent = foam.core.reflow.AbstractSinkDAOAgent.isInstance(select);
        return isSinkAgent ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'String',
      name: 'where',
      section: 'filter',
      displayWidth: 60,
      view: { class: 'foam.core.reflow.PredicateSuggestedField' }
//      view: { class: 'foam.u2.TextField', type: 'search' } // adds 'x' to clear field
    },
    {
      class: 'String',
      name: 'order',
      section: 'filter',
      displayWidth: 60,
      view: { class: 'foam.core.reflow.ComparatorSuggestedField' }
//      view: { class: 'foam.u2.TextField', type: 'search' } // adds 'x' to clear field
    },
    {
      class: 'String',
      name: 'columns',
      section: 'filter',
      displayWidth: 60,
      view: function(_, X) {
        return {
          class: 'foam.core.reflow.PropertySuggestedField'
        };
      },
      postSet: function(_, n) {
        this.updateColumnStorage(n);
      }
    },
    {
      name: 'columnStorage',
      transient: true,
      hidden: true,
      section: 'filter',
      factory: function() {
        var self = this;
        return Object.create({
          getItem: function(k) { return this[k] || null; },
          setItem:    function(k, v) {
            this[k] = v;
            // save column updates from tableview
            self.columns = self.getColumnNamesFromStorage(v);
          },
          removeItem: function(k)    { delete this[k]; },
          clear:      function()     { for ( const k in this ) delete this[k]; }
        });
      }
    },
    {
      name: 'select',
      view: function(_, X) {
        return foam.core.reflow.SinkView.create({
          sinksOnly: false,
          choice: 'Table',
          dao: X.data.dao}, X.data);
visible      },
      preSet: function(o, n) {
        // Temporary fix to recontextualize the object after load.
        // TODO: remove once JSON parsing/loading is fixed
        if ( n && n.__context__ != this.__subContext__ ) {
          return n.clone(this.__subContext__);
        }
        return n;
      },
      reactive: false,
      section: 'output',
      label: '',
      factory: function() { return this.TableDAOAgent.create(); }
    },
    { class: 'Long',       hidden: true,  name: 'rowCount', visibility: 'RO' },
    { class: 'String',     hidden: true,  name: 'executionTime', value: '-', visibility: 'RO', transient: true, readPermissionRequired: true },
    { class: 'Boolean',    section: 'general',   name: 'autoRun', view: { class: 'foam.u2.Switch' } },
    { class: 'Int',        hidden: true,  name: 'version', hidden: true },
    { class: 'FObjectProperty',  name: 'value', transient: true, hidden: true, visibility: 'RO' },
    {
      name: 'readyLatch_',
      transient: true,
      hidden: true,
      factory: function() {
        return foam.lang.Latch.create();
      }
    }
  ],

  methods: [
    function getColumnNamesFromStorage(json) {
      if ( ! json ) return null;
      return JSON.parse(json)?.map(a => a[0]).join(',');
    },

    function updateColumnStorage(columns) {
      if ( columns === this.getColumnNamesFromStorage(this.columnStorage.getItem(this.dao.of.id)) )
        return;
      var defaultCols = JSON.parse(localStorage.getItem(this.dao.of.id));
      var cols = columns?.trim().length > 0 ?
        columns.trim().split(',').map(c => c.trim()).filter(c => c).map(c => {
          var defaultCol = defaultCols?.find(dc => dc[0] === c );
          var w = defaultCol ? defaultCol[1] : 0;
          return [c, w];
        }) :
        defaultCols;
        this.columnStorage[this.dao.of.id] = JSON.stringify(cols);
    },

    function init() {
      this.SUPER();
      if ( ! this.columns ) {
        this.columns = this.getColumnNamesFromStorage(localStorage.getItem(this.dao.of.id));
      }
      this.where$.sub(this.maybeAutoRun);
      this.order$.sub(this.maybeAutoRun);
    },

    async function addToE(e) {
      this.onDetach(this.dao.listen(this.updateRowCount));
      this.updateRowCount_();

      // TODO: name current block
      e.tag(this.DAOPromptView, {data: this, label: this.label});
//      e.tag(this.DAOPromptView.create({data: this, label: this.label}, this));
    },

    function onLoad() {
      return this.readyLatch_;
    },

    function waitForRun() {
      this.readyLatch_ = undefined;
      this.run();
      return this.readyLatch_;
    },

    async function updateRowCount_() {
      this.rowCount = (await this.filteredDAO.select(this.COUNT())).value;
    }
  ],

  actions: [
    {
      name: 'run',
      section: 'actions',
      size: 'SMALL',
      buttonStyle: foam.u2.ButtonStyle.PRIMARY,
      code: function() {
        this.version++;
      }
    },
    {
      name: 'describeModel',
      section: 'actions',
      availablePermissions: [ 'command.read.describe' ],
      code: function() {
        this.eval_('describe ' + this.dao.of.id);
      }
    },
    {
      name: 'createTest',
      section: 'actions',
      // TODO:
//      isEnabled: function(value) { return this.value; },
      availablePermissions: [ 'command.read.test' ],
      code: async function() {
        // Run run() before testing to ensure output is correct.
        await this.waitForRun();

        var name = this.block.flowName;
        this.eval_(`test(${name}.value,'Test output of ${name}')`);
      }
    }
  ],

  listeners: [
    {
      name: 'updateRowCount',
      isFramed: true,
      code: function() { this.updateRowCount_(); this.run(); }
    },
    {
      name: 'maybeAutoRun',
      isMerged: true,
      delay: 200,
      code: function maybeAutoRun() {
        if ( this.autoRun ) this.run();
      }
    }
  ]
});

// Does DAO.orderBy() take vargs? It should.
