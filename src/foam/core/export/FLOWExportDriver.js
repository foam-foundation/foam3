/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.export',
  name: 'FLOWExportDriver',

  implements: [
    'foam.core.export.TableExportDriver',
    'foam.mlang.Expressions'
  ],

  requires: [ 'foam.core.reflow.Flow' ],

  imports: [ 'currentMenu', 'flowDAO' ],

  properties: [
    {
      class: 'String',
      name: 'name'
    },
    {
      class: 'String',
      name: 'description',
      width: 80
    },
    {
      class: 'Boolean',
      name: 'openOnCreate',
      value: false
    },
    { name: 'addUnits', hidden: true },
    { name: 'daoKey', hidden: true },
    { name: 'dao',    hidden: true },
    { name: 'of',     hidden: true },
    { name: 'plural', hidden: true }
  ],

  methods: [
    async function init() {
      this.SUPER();

      try {
        // TODO: Make work when used from Data Management menus
        this.daoKey = this.currentMenu.handler.config.daoKey;
        this.dao    = this.__context__[this.daoKey];
        this.of     = this.dao.of;
        this.plural = this.of.model_.plural;
        this.name   = await this.suggestName(this.of);
      } catch (x) {
        this.name = 'Unsupported for Data Management Menus';
      }
    },

    async function suggestName() {
      var prefix = this.plural + ' View ';
      for ( var i = 1 ; i < 199 ; i++ ) {
        var name = prefix + i;
        var count = await this.flowDAO.limit(1).where(this.EQ(this.Flow.ID, name)).select(this.COUNT());
        if ( count.value == 0 ) return name;
      }
      return 'Unnamed';
    },

    function exportFObject(X, obj) {
      return '/flow.html';
    },

    function findComparator(dao) {
      // Doesn't work. TableView's sort order isn't shared
      for ( ; dao ; dao = dao.delegate) {
        if ( foam.dao.OrderedDAO.isInstance(dao) && dao.comparator )
          return dao.comparator;
      }
    },

    function findPredicate(dao) {
      for ( ; dao ; dao = dao.delegate) {
        if ( foam.dao.FilteredDAO.isInstance(dao) ) {
          return dao.predicate;
        }
      }
    },

    function exportDAO(X, dao) {
      var of = this.of || dao.of;
      if ( ! of ) {
        console.error('FLOWExportDriver: No model class available for export');
        return '';
      }

      var propNames = this.getPropName(X, dao.of);
      var where     = '';
      var comp      = this.findComparator(dao);
      var p         = this.findPredicate(dao);

      if ( p ) {
        p = p.partialEval();
        if ( p.toMQL )
          where = `\n      "where": ${JSON.stringify(p.toMQL())},`;
      }

      if ( comp ) { debugger; }

      var daoKey = this.daoKey || X.serviceName;
      var plural = this.plural || of.model_.plural;

      var columnsArray = JSON.stringify(propNames);
      var columnsString = propNames.join(',');

      var label = this.name || plural;

      var flow = this.Flow.create({
        name: this.name,
        description: this.description,
        source: daoKey,
        script: `[
  {
    "flowName": "${plural}1",
    "cmd": "dao ${daoKey}",
    "value": {
      "class": "foam.core.reflow.DAOPrompt",${where}
      "select": {
        "class": "foam.core.reflow.TableDAOAgent",
        "columns": ${columnsArray}
      },
      "label": "${label}",
      "columns": "${columnsString}"
    },
    "border": {
      "title": "${label}",
      "oldTitleStyle_": "h300"
    },
    "padding_st": "16px"
  }
]`
      });
      this.flowDAO.put(flow).then(() => {
        if ( this.openOnCreate )
          this.__context__.routeTo('flow/' + this.name + '?flowMode=PRESENTATION');
      });
      return ''; // prevents redirect
    }
  ]
});
