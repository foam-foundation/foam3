/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.LIB({
  name: 'foam.parse.rail.ParserIds',

  documentation: `
    Small stable integer ids for parser objects so a path of parsers can be a
    string key. Backed by a WeakMap: parsers are never kept alive by the viewer.
  `,

  methods: [
    function idOf(p) {
      var m = this.map_ || ( this.map_ = new WeakMap() );
      if ( ! m.has(p) ) m.set(p, ( this.next_ = ( this.next_ || 0 ) + 1 ));
      return m.get(p);
    },

    function keyOf(ids) {
      /** "3/7/12": ids joined by "/", outermost first. */
      return ids.join('/');
    }
  ]
});
