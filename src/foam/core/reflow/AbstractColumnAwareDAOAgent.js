/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'AbstractColumnAwareDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  imports: [
    'block',
    'dao as referenceDAO',
    'sinkDAO as dao',
    'sinkUnlimitedDAO as unlimitedDAO',
    'flowColumns? as columns'
  ],

  properties: [
    'props',
    [ 'useProjection', false ]
  ],

  methods: [
    function createSink() {
      return this.useProjection ? this.getProjectionSink() : this.getSink();
    },
    function addSinkToE(e, s) {
      s = this.useProjection ? this.getSinkWithProjectionData(s) : s;
      e.add(s);
    },
    async function execute(e) {
      var SUPER = this.SUPER.bind(this);
      if ( this.columns?.length ) {
        this.props = this.columns.split(',');
        this.useProjection = true;
      } else {
        this.props = null;
        this.useProjection = false;
      }
      return SUPER(e);
    },
    function getProjectionSink() {
      var exprArray = [];
      for ( var propName of this.props ) {
        var expr = this.of.getAxiomByName(propName) || foam.core.column.NestedPropertiesExpression.create({ objClass: this.of, nestedProperty: propName });
        if ( foam.dao.DAOProperty.isInstance(expr) ||
            foam.dao.OneToManyRelationshipProperty.isInstance(expr) ||
            foam.dao.ManyToManyRelationshipProperty.isInstance(expr) ||
            foam.lang.Action.isInstance(expr) )
          continue
        if ( expr )
          exprArray.push(expr);
      }

      return this.Projection.create({ exprs: exprArray, useProjection: true });
    },
    function getSinkWithProjectionData(s) {
      if ( this.Projection.isInstance(s) ) {
        var data = [];
        var of = { __proto__: this.of };
        of.private_ = { axiomCache: {'foam.lang.Property': s.exprs} }
        s.projection.forEach(p => {
          var objSpec = {};
          var i = 0;
          s.exprs.forEach(e => {
            objSpec[e.name] = p[i++];
          });
          data.push(of.create(objSpec));
        })
        var sink = this.getSink();
        sink.of = of;
        sink.array = data;
        return sink;
      }
      return s;
    }
  ]
});
