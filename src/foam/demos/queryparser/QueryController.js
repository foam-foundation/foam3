foam.CLASS({
  package: 'foam.demos.queryparser',
  name: 'QueryComplete',

  documentation: `
    Usage:
      'query' is bound to the query string to be autocompleted
      Before 'query' is changed, the reset() method is called
      The query is parsed and apply() is passed to parseString() so the AutoCompleter
        can be informed of the parsing process.
      During the parseString(), apply() builds up the maps 'suggestions'
        which are used to make suggestions.
      The render() method re-renders after query has changed to show updated suggestions.
      If the user clicks on a suggestion, it's output is appended to the query.
  `,

  properties: [
    {
      class: 'String',
      name: 'autoQuery',
      postSet: function() {
        this.reset();
      }
    },
    {
      class: 'String',
      name: 'normalizedQuery'
    },
    {
      class: 'Boolean',
      name: 'normalize'
    },
    {
      class: 'Int',
      name: 'maxPos'
    },
    {
      name: 'suggestions',
      factory: function() { return {}; }
    },
    {
      name: 'apply',
      factory: function() {
        let self = this;

        function maybeAdd(p, ss) {
          try {
            if ( p.suggest ) {
              let s = p.suggest();
              if ( s ) {
                let label = s.tooltip || s.text;
                if ( ! ss[label] ) {
                  ss[label] = s;
                }
              }
            }
          } catch(x) {}
        }

        // return the function that will be passed to parseString
        // p is the parser
        // grammar with all the symbols
        return function(p, grammar) {
          // 'this' is the JSPStream

           //console.log('parsing: ' + self.autoQuery + ' length ' + self.autoQuery.length );

          if ( this.pos > self.maxPos ) {
            self.suggestions = {};
            self.maxPos = this.pos;
          }

          if ( this.pos == self.maxPos ) {
            maybeAdd(p, self.suggestions);
          }

          let result = p.parse(this, grammar);


          if ( self.normalize && result && p.suggest ) {
            let s = p.suggest();
            if ( ! s.text ) return result;
            //console.log('suggestion for ' + this.substring(result) + '->' + s.text + ' at ' + this.pos);
            let prevQuery = self.autoQuery.substring(0, this.pos);
            self.normalizedQuery = prevQuery + s.text + self.autoQuery.substring(this.substring(result).length+this.pos) ;
            console.log('--- normalized query ---: ' + self.normalizedQuery + ' length ' + self.normalizedQuery.length);
            self.autoQuery = self.normalizedQuery;

          }

          return result;
        }
      }
    }
  ],

  methods: [
    function reset() {
      this.maxPos              = 0;
      this.suggestions         = {};
      this.normalizedQuery     = '';
    },
    function toString() {
      return Object.keys(this.suggestions).join(' | ');
    },
    function addToE(e) {
      function containsIC(str, sub) {
        return str.toLowerCase().indexOf(sub.toLowerCase()) != -1;
      }
      var self = this;
      e.add(this.dynamic(function(autoQuery) {; // re-render when query changes
        let keys   = Object.keys(self.suggestions);
        let delta  = autoQuery.substring(self.maxPos);
        let ss     = keys.sort();

        if ( delta ) ss = ss.filter(k => containsIC(k, delta));
        if ( ! ss.length ) return;

        this.start().style({width: '400px', maxHeight: '500px', border: '1px solid gray', overflowY: 'auto'}).forEach(ss, function(s) {
          let sug = self.suggestions[s];

          this.start('div').
            style({margin: '6px'}).
            callIfElse(sug.tooltip, function() {
              this.start('span').style({fontStyle: 'italic', color: 'gray'}).add(sug.tooltip);
            }, function() {
              this.on(
                'click',
                function() {
                  self.autoQuery = ( self.autoQuery.substring(0, self.maxPos).trim() + ' ' + s ).trimStart();
                }).
                style({cursor: 'pointer'});
            }).
            add(self.suggestions[s].label).
          end();
        });
      }));
    }
  ]
});


foam.CLASS({
  package: 'foam.demos.queryparser',
  name: 'QueryController',
  extends: 'foam.u2.Controller',

  requires: [ 'foam.parse.SimpleQueryParser', 'foam.demos.queryparser.QueryComplete' ],

  properties: [
    {
      name: 'autoCompleter',
      factory: function() {
        //return this.QueryComplete.create({query$: this.query$});

        let qc = this.QueryComplete.create({normalize: true});
          this.query$.follow(qc.autoQuery$);
        return qc

      }
    },
    {
      class: 'String',
      name: 'query',
      onKey: true,
      view: function(_, X) {
        let view = foam.u2.TextField.create();
        X.data.query$.sub(()=>view.focus());
        return view;
      }
    },
    {
      name: 'parser',
      factory: function() {
        return this.SimpleQueryParser.create({of: foam.core.auth.User});
//        return this.QueryParser.create({of: foam.util.Timer});
      }
    },
    {
      name: 'predicate',
      expression: function(query) {
        this.autoCompleter.autoQuery = query;
        //this.autoCompleter.reset();
        console.log('*** parsing query ***: ' + query + ' length ' + query.length );
        let ps = this.parser.parseString( query + String.fromCharCode(26), undefined, this.autoCompleter.apply);
        /*
        if (this.autoCompleter.normalizedQuery && this.autoCompleter.normalizedQuery !== this.query.substring(0, this.autoCompleter.normalizedQuery.length))
          this.query = this.autoCompleter.normalizedQuery;
        */
        return ps || null;
      }
    },
    {
      class: 'String',
      name: 'result',
      expression: function(predicate) {
        return predicate ? predicate.toString() : '';
      }
    },
    {
      class: 'String',
      name: 'suggestion'
    }
  ],

  methods: [
    function render() {
      this.add(this.QUERY.__); // adds label and validation, access control
      this.autoCompleter.addToE(this);
      this.br().add(this.RESULT.__);
    }
  ]

});
