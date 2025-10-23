/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'Or',
  extends: 'foam.mlang.predicate.Nary',
  implements: [ 'foam.lang.Serializable' ],

  documentation: 'Logical Or n-ary Predicate.',

  requires: [
    'foam.mlang.predicate.False',
    'foam.mlang.predicate.True'
  ],

  methods: [
    {
      name: 'f',
      code: function f(o) {
        for ( var i = 0 ; i < this.args.length ; i++ ) {
          try { if ( this.args[i].f(o) ) return true; } catch (x) {}
        }
        return false;
      },
      swiftCode: `
for arg in args {
  if arg.f(obj) { return true }
}
return false
`,
      javaCode: `
      for ( int i = 0 ; i < getArgs().length ; i++ ) {
        try {
          if ( getArgs()[i].f(obj) ) return true;
        } catch (Throwable t) {
        }
      }
      return false;
    `
  },
    {
      name: 'createStatement',
      type: 'String',
      javaCode:
`StringBuilder stmt = new StringBuilder();
Predicate[] predicates = getArgs();
int length = predicates.length;

for ( int i = 0 ; i < length ; i++ ) {
  Predicate predicate = predicates[i];
  stmt.append(" (").append(predicate.createStatement()).append(") ");
  if ( i != length - 1 ) {
    stmt.append(" OR ");
  }
}
return stmt.toString();`
    },

    {
      name: 'partialEval',
      code: function partialEval() {
        var newArgs = [];
        var updated = false;

        var TRUE  = this.True.create();
        var FALSE = this.False.create();

        for ( var i = 0 ; i < this.args.length ; i++ ) {
          var a    = this.args[i];
          var newA = this.args[i].partialEval();

          if ( newA === TRUE ) return TRUE;

          if ( this.cls_.isInstance(newA) ) {
            // In-line nested OR clauses
            for ( var j = 0 ; j < newA.args.length ; j++ ) {
              newArgs.push(newA.args[j]);
            }
            updated = true;
          }
          else {
            if ( newA !== FALSE ) {
              newArgs.push(newA);
            }
            if ( a !== newA ) updated = true;
          }
        }

        this.reduce_(newArgs, FALSE, 'reduceOr');

        if ( newArgs.length === 0 ) return FALSE;
        if ( newArgs.length === 1 ) return newArgs[0];

        return updated ? this.cls_.create({ args: newArgs }) : this;
      },
      javaCode:
        `java.util.List<Predicate> args = new java.util.ArrayList<>();
boolean update = false;

for ( int i = 0 ; i < this.args_.length ; i++ ) {
  Predicate arg    = this.args_[i];
  Predicate newArg = this.args_[i].partialEval();
  if ( newArg == foam.mlang.MLang.TRUE ) return foam.mlang.MLang.TRUE;
  if ( newArg instanceof Or ) {
    for ( int j = 0; j < ( ( (Or) newArg ).args_.length ); j++ ) {
      args.add(((Or) newArg).args_[j]);
    }
    update = true;
  } else {
    if ( newArg == foam.mlang.MLang.FALSE || arg == null ) {
      update = true;
    } else {
      args.add(newArg);
      if ( ! arg.equals(newArg) ) update = true;
    }
  }
}

if ( args.size() == 0 ) return foam.mlang.MLang.FALSE;
if ( args.size() == 1 ) return args.get(0);
if ( update ) {
  Predicate newArgs[] = new Predicate[args.size()];
  int i = 0;
  for ( Predicate predicate : args )
    newArgs[i++] = predicate;
  return new Or(newArgs);
}
return this;`
    },

    function toIndex(tail) { },

    function toDisjunctiveNormalForm() {
      // TODO: memoization around this process?
      // DNF our args, note if anything changes
      var oldArgs = this.args;
      var newArgs = [];
      var changed = false;
      for (var i = 0; i < oldArgs.length; i++ ) {
        var a = oldArgs[i].toDisjunctiveNormalForm();
        if ( a !== oldArgs[i] ) changed = true;
        newArgs[i] = a;
      }

      // partialEval will take care of nested ORs
      var self = this;
      if ( changed ) {
        self = this.clone();
        self.args = newArgs;
        self = self.partialEval();
      }

      return self;
    },
    function toMQL() {
      var mqlStringsArr = [];
      for ( var a in this.args ) {
        if ( ! this.args[a].toMQL )
          throw new Error( 'Predicate\'s argument does not support toMQL' );
        var mql = this.args[a].toMQL();
        if ( mql )
          mqlStringsArr.push(mql);
      }
      return mqlStringsArr.join(' OR ');
    }
  ]
});
