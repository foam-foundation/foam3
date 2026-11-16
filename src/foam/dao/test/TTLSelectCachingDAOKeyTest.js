/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'TTLSelectCachingDAOKeyTest',
  extends: 'foam.core.test.JSTest',

  documentation: `TTLSelectCachingDAO keys a cached select by the sink's
    toString(). A GroupBy subclass with no toString() of its own prints the
    same text as a plain GroupBy on the same fields, so the key also carries
    the sink's class: the subclass must get its own result, and the same sink
    asked twice must still be served from the cache.`,

  requires: [
    'foam.dao.ArrayDAO',
    'foam.dao.TTLSelectCachingDAO',
    'foam.mlang.sink.Count',
    'foam.mlang.sink.GroupBy'
  ],

  classes: [
    {
      name: 'Rec',
      properties: [
        { class: 'Long',   name: 'id' },
        { class: 'String', name: 'year' }
      ]
    },
    {
      // Inherits GroupBy's toString(), like a chart sink that adds only
      // display settings.
      name: 'ChartGroupBy',
      extends: 'foam.mlang.sink.GroupBy'
    },
    {
      // Counts the selects that reach the source, to tell a cache hit from
      // a miss.
      name: 'CountingDAO',
      extends: 'foam.dao.ProxyDAO',
      properties: [
        { class: 'Int', name: 'selects' }
      ],
      methods: [
        function select_(x, sink, skip, limit, order, predicate) {
          this.selects++;
          return this.SUPER(x, sink, skip, limit, order, predicate);
        }
      ]
    }
  ],

  methods: [
    async function runTest(x) {
      var R      = this.Rec;
      var source = this.CountingDAO.create({ delegate: this.ArrayDAO.create({ of: R }, x) }, x);
      await source.put(R.create({ id: 1, year: '2025' }, x));
      await source.put(R.create({ id: 2, year: '2026' }, x));

      var dao = this.TTLSelectCachingDAO.create({ delegate: source }, x);
      var self = this;
      function plain() { return self.GroupBy.create({ arg1: R.YEAR, arg2: self.Count.create() }, x); }
      function chart() { return self.ChartGroupBy.create({ arg1: R.YEAR, arg2: self.Count.create() }, x); }

      x.test(plain().toString() === chart().toString(),
        'Both sinks print the same text, so only the class tells them apart. Got: ' + chart().toString());

      var first = await dao.select(plain());
      x.test(! this.ChartGroupBy.isInstance(first), 'A plain GroupBy select returns a plain GroupBy');
      x.test(source.selects === 1, 'The first select reaches the source. Selects: ' + source.selects);

      var again = await dao.select(plain());
      x.test(source.selects === 1, 'The same GroupBy again is served from the cache. Selects: ' + source.selects);
      x.test(Object.keys(again.groups).length === 2, 'The cached copy keeps both year groups. Got: ' + Object.keys(again.groups).length);

      var other = await dao.select(chart());
      x.test(this.ChartGroupBy.isInstance(other),
        'The subclass on the same field gets its own result, not the cached GroupBy. Got: ' + other.cls_.id);
      x.test(source.selects === 2, 'The subclass select reaches the source. Selects: ' + source.selects);
    }
  ]
});
