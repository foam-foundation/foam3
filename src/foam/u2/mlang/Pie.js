/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyRefinement',
  refines: 'Property',

  properties: [
    {
      class: 'Map',
      name: 'colorMap'
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.mlang',
  name: 'Pie',
  extends: 'foam.mlang.sink.GroupBy',

  requires: [
    'foam.graphics.DataSource',
    'foam.graphics.PieGraph'
  ],

  properties: [
    'graphColors',
    { name: 'width',  factory: function() { return this.radius * 4; }, transient: true },
    { name: 'height', factory: function() { return this.radius * 3.5; }, transient: true },
    [ 'margin', 1.5 ],
    { class: 'Int', name: 'radius', value: 50 },
    { name: 'x', factory: function() { return this.radius; }, transient: true },
    { name: 'y', factory: function() { return this.radius * 0.75; }, transient: true },
    {
      name: 'graph_',
      expression: function(groups) {
        var keys = Object.keys(groups);
        var l    = keys.length;
        this.graphColors = keys.map((k,i) => {
          var c = this.arg1?.colorMap[k] ;
          if ( c ) return c;
          if ( foam.lang.Enum.isInstance(this.arg1) ) {
            var color = this.arg1.of[k].color;
            if ( color ) return color;
          }
          return this.hsl(i/(l+1)*360, 90, 50);
        });
        var seriesValues = Object.values(groups).map(sink => sink.value);
        if ( ! seriesValues.length ) seriesValues = [0];
        var p = this.PieGraph.create(this);
        p.seriesValues = seriesValues;
        return p;
      }
    }
  ],

  methods: [
    // A DAO that caches selects (TTLSelectCachingDAO) keys them by the sink's
    // toString(). GroupBy's names no class, so this Pie and a plain GroupBy
    // on the same field would share a cached result; naming the class keeps
    // them apart.
    function toString() { return this.cls_.id + ':' + this.SUPER(); },
    function hsl(h, s, l) { return 'hsl(' + h + ',' + s + '%,' + l + '%)'; },
    function toE(_, x) { return x.E().add(this.graph_$); },
    function addToE(e) { e.add(this.graph_$); }
  ]
});
