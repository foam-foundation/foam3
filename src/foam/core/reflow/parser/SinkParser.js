/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.parser',
  name: 'SinkParser',
  extends: 'foam.parse.Grammar',

  requires: [
    'foam.parse.Alternate',
    'foam.parse.Parsers' // ????
  ],

  imports: [
    'agentDAO'
  ],

  properties: [ { name: 'alt', factory: function() { return this.Alternate.create(); } } ],

  methods: [
    async function aInit() {
      const p          = this.Parsers.create(); // ???
      const comparator = (a, b) => b.length - a.length || foam.util.compare(a, b);

      (await this.agentDAO.select()).array.sort(comparator).forEach(a => {
        let parser = p.sug(p.literalIC(a.label, a), {
          text: a.label,
          prependSpaceOnSelect: false,
          category: 'target'});

        try {

          // TODO: move to sinkAgent object
          let cls  = foam.lookup(a.value);
          let sink = cls.create({}, this);

          if ( sink.parser ) {
            parser = p.seq(parser, ' ', sink.parser);
          } else {
            //          parser = p.seq(parser);
          }
        } catch (x) {
          debugger;
        }

        this.alt.args.push(parser);
      });
    },

    function grammar() {
      return {
        START: this.alt
      };
    },

    function STARTAction(v) {
      try {
        // return foam.lookup(v.value).create({}, this);
        //        console.log('*************V:', v, v[0]?.value);
        debugger;
        if ( foam.Array.isInstance(v) ) {
          return v[2];
        }
        if ( foam.core.reflow.SinkAgent.isInstance(v) ) {
          return foam.lookup(v.value).create({}, this);
        }
        return v;
      } catch (x) {
        debugger;
        return v;
      }
    }
  ]
});
