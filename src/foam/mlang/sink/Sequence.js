/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'Sequence',
  extends: 'foam.dao.AbstractSink',
  implements: [ 'foam.lang.Serializable' ],

  properties: [
    {
      class: 'Boolean',
      name: 'horizontal'
    },
    {
      class: 'Array',
      type: 'foam.dao.Sink[]',
      name: 'args'
    }
  ],

  methods: [
    {
      name: 'setX',
      args: 'foam.lang.X x',
      javaCode: `
        super.setX(x);
        // Propagate context to child sinks
        if ( getArgs() != null ) {
          for ( int i = 0; i < getArgs().length; i++ ) {
            if ( getArgs()[i] instanceof foam.lang.FObject ) {
              ((foam.lang.FObject)getArgs()[i]).setX(x);
            }
          }
        }
      `
    },
    {
      name: 'put',
      code: function(obj, s) {
        this.args.forEach(function(a) {
          a.put(obj, s);
        });
      },
      javaCode: `for ( int i = 0 ; i < getArgs().length ; i++ ) {
  getArgs()[i].put(obj, sub);
}`
    },
    {
      name: 'remove',
      code: function(obj, s) {
        this.args.forEach(function(a) { a.remove(obj, s); });
      },
      javaCode: `for ( int i = 0 ; i < getArgs().length ; i++ ) {
  getArgs()[i].remove(obj, sub);
}`
    },
    {
      name: 'reset',
      code: function(s) {
        this.args.forEach(function(a) { a.reset(s); });
      },
      javaCode: `for ( int i = 0 ; i < getArgs().length ; i++ ) {
  getArgs()[i].reset(sub);
}`
    },
    function toString() {
      return 'SEQ(' + this.args.map(function(a) { return a.toString(); }).join(',') + ')';
    },
    function addToE(e) {
      var self = this;
      if ( this.horizontal ) {
        e.start('span').style({display:'flex'}).call(function() {
          self.args.forEach(a => e.start('span').style({padding: '8px'}).add(a));
        });
      } else {
        this.args.forEach(a => e.start('div').add(a));
      }
    },

    function toProperties() {
      var allProps     = this.args.map(a => a.toProperties ? a.toProperties() : a.VALUE).flat();
      var nameCount    = {};
      var renamedProps = [];

      // Track name usage and rename duplicates
      allProps.forEach(prop => {
        if ( ! prop || ! prop.name ) {
          renamedProps.push(prop);
          return;
        }

        var originalName = prop.name;
        if ( nameCount[originalName] ) {
          // This name already exists, create a unique version
          nameCount[originalName]++;
          var newProp = prop.clone ? prop.clone() : foam.util.clone(prop);
          newProp.name = originalName + '_' + nameCount[originalName];
          newProp.label = foam.String.labelize(newProp.name);
          renamedProps.push(newProp);
        } else {
          // First occurrence of this name
          nameCount[originalName] = 1;
          renamedProps.push(prop);
        }
      });

      return renamedProps;
    },

    function setPropertyValues(o, sink, ps) {
      // Map through properties and set values from corresponding sink args
      var propIndex = 0;
      for ( var i = 0 ; i < this.args.length ; i++ ) {
        var arg      = sink.args[i];
        var argProps = arg.toProperties ? arg.toProperties() : [{ name: 'value' }];
        var propsForArg = [];

        // Collect the properties that belong to this arg
        if ( argProps && Array.isArray(argProps) ) {
          for ( var j = 0 ; j < argProps.length ; j++ ) {
            if ( propIndex < ps.length ) {
              propsForArg.push(ps[propIndex]);
              propIndex++;
            }
          }
        } else {
          if ( propIndex < ps.length ) {
            propsForArg.push(ps[propIndex]);
            propIndex++;
          }
        }

        // Delegate to child's setPropertyValues if it has one
        if ( arg.setPropertyValues ) {
          arg.setPropertyValues(o, sink.args[i], propsForArg);
        } else {
          // Otherwise, set values the normal way
          for ( var k = 0 ; k < propsForArg.length ; k++ ) {
            propsForArg[k].set(o, arg.value);
          }
        }
      }
    }
  ]
});
