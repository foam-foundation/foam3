/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'And',
  extends: 'foam.mlang.predicate.Nary',
  implements: ['foam.lang.Serializable'],

  documentation: 'Logical And n-ary Predicate.',

  requires: [
    'foam.mlang.predicate.Or'
  ],

  methods: [
    {
      name: 'f',
      code: function(o) {
        for ( var i = 0 ; i < this.args.length ; i++ ) {
          if ( ! this.args[i].f(o) ) return false;
        }
        return true;
      },
      swiftCode: `
for arg in args {
  if !arg.f(obj) { return false }
}
return true
`,
      javaCode: `for ( int i = 0 ; i < getArgs().length ; i++ ) {
                  if ( ! getArgs()[i].f(obj) ) return false;
                }
                return true;`
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
    stmt.append(" AND ");
  }
}
return stmt.toString();`
    },

    {
      name: 'partialEval',
      code: function partialEval() {
        var newArgs = [];
        var updated = false;

        var FALSE = foam.mlang.predicate.False.create();
        var TRUE  = foam.mlang.predicate.True.create();

        for ( var i = 0 ; i < this.args.length ; i++ ) {
          var a    = this.args[i];
          var newA = this.args[i].partialEval();

          if ( newA === FALSE ) return FALSE;

          if ( this.cls_.isInstance(newA) ) {
            // In-line nested AND clauses
            for ( var j = 0 ; j < newA.args.length ; j++ ) {
              newArgs.push(newA.args[j]);
            }
            updated = true;
          }
          else {
            if ( newA === TRUE ) {
              updated = true;
            } else {
              newArgs.push(newA);
              if ( a !== newA ) updated = true;
            }
          }
        }

        this.reduce_(newArgs, TRUE, 'reduceOr');

        if ( newArgs.length === 0 ) return TRUE;
        if ( newArgs.length === 1 ) return newArgs[0];

        return updated ? this.cls_.create({ args: newArgs }) : this;
      },
      javaCode:
        `java.util.List<Predicate> args = null;
boolean update = false;
for ( int i = 0 ; i < this.args_.length ; i++ ) {
  Predicate arg    = this.args_[i];
  Predicate newArg = this.args_[i].partialEval();
  if ( newArg == foam.mlang.MLang.FALSE ) return foam.mlang.MLang.FALSE;
  if ( newArg instanceof And ) {
    if ( args == null ) args = new java.util.ArrayList<>();
    for ( int j = 0 ; j < (((And) newArg).args_.length ) ; j++ ) {
      args.add(((And) newArg).args_[j]);
    }
    update = true;
  } else {
    if ( newArg == foam.mlang.MLang.TRUE || newArg == null ) {
      update = true;
    } else {
      if ( args == null ) args = new java.util.ArrayList<>();
      args.add(newArg);
      if ( ! arg.equals(newArg) ) update = true;
    }
  }
}

if ( args == null || args.size() == 0 ) return foam.mlang.MLang.TRUE;
if ( args != null && args.size() == 1 ) return args.get(0);

if ( update ) {
  Predicate newArgs[] = new Predicate[args.size()];
  int i = 0;
  for ( Predicate predicate : args )
    newArgs[i++] = predicate;
  return new And(newArgs);
}
return this;`
    },

    function toIndex(tail, depth) {
      /** Builds the ideal index for this predicate. The indexes will be chained
          in order of index uniqueness (put the most indexable first):
          This prevents dropping to scan mode too early, and restricts
          the remaning set more quickly.
           i.e. EQ, IN,... CONTAINS, ... LT, GT...
        @param depth {number} The maximum number of sub-indexes to chain.
      */
      depth = depth || 99;

      if ( depth === 1 ) {
        // generate indexes, find costs, use the fastest
        var bestCost = Number.MAX_VALUE;
        var bestIndex;
        var args = this.args;
        for (var i = 0; i < args.length; i++ ) {
          var arg = args[i];
          var idx = arg.toIndex(tail);
          if ( ! idx ) continue;

          var idxCost = Math.floor(idx.estimate(
             1000, undefined, undefined, undefined, undefined, arg));

          if ( bestCost > idxCost ) {
            bestIndex = idx;
            bestCost = idxCost;
          }
        }
        return bestIndex;

      } else {
        // generate indexes, sort by estimate, chain as requested
        var sortedArgs = Object.create(null);
        var costs = [];
        var args = this.args;
        var dupes = {}; // avoid duplicate indexes
        for (var i = 0; i < args.length; i++ ) {
          var arg = args[i];
          var idx = arg.toIndex(tail);
          if ( ! idx ) continue;

          // duplicate check
          var idxString = idx.toString();
          if ( dupes[idxString] ) continue;
          dupes[idxString] = true;

          var idxCost = Math.floor(idx.estimate(
             1000, undefined, undefined, undefined, undefined, arg));
          // make unique with a some extra digits
          var costKey = idxCost + i / 1000.0;
          sortedArgs[costKey] = arg;
          costs.push(costKey);
        }
        costs = costs.sort(foam.Number.compare);

        // Sort, build list up starting at the end (most expensive
        //   will end up deepest in the index)
        var tailRet = tail;
        var chainDepth = Math.min(costs.length - 1, depth - 1);
        for ( var i = chainDepth; i >= 0; i-- ) {
          var arg = sortedArgs[costs[i]];
          //assert(arg is a predicate)
          tailRet = arg.toIndex(tailRet);
        }

        return tailRet;
      }
    },

    function toDisjunctiveNormalForm() {
      // for each nested OR, multiply:
      // AND(a,b,OR(c,d),OR(e,f)) -> OR(abce,abcf,abde,abdf)

      var andArgs = [];
      var orArgs  = [];
      var oldArgs = this.args;
      for (var i = 0; i < oldArgs.length; i++ ) {
        var a = oldArgs[i].toDisjunctiveNormalForm();
        if ( this.Or.isInstance(a) ) {
          orArgs.push(a);
        } else {
          andArgs.push(a);
        }
      }

      if ( orArgs.length > 0 ) {
        var newAndGroups = [];
        // Generate every combination of the arguments of the OR clauses
        // orArgsOffsets[g] represents the array index we are lookig at
        // in orArgs[g].args[offset]
        var orArgsOffsets = new Array(orArgs.length).fill(0);
        var active = true;
        var idx = orArgsOffsets.length - 1;
        orArgsOffsets[idx] = -1; // compensate for intial ++orArgsOffsets[idx]
        while ( active ) {
          while ( ++orArgsOffsets[idx] >= orArgs[idx].args.length ) {
            // reset array index count, carry the one
            if ( idx === 0 ) { active = false; break; }
            orArgsOffsets[idx] = 0;
            idx--;
          }
          idx = orArgsOffsets.length - 1;
          if ( ! active ) break;

          // for the last group iterated, read back up the indexes
          // to get the result set
          var newAndArgs = [];
          for ( var j = orArgsOffsets.length - 1; j >= 0; j-- ) {
            newAndArgs.push(orArgs[j].args[orArgsOffsets[j]]);
          }
          newAndArgs = newAndArgs.concat(andArgs);

          newAndGroups.push(
            this.cls_.create({ args: newAndArgs })
          );
        }
        return this.Or.create({ args: newAndGroups }).partialEval();
      } else {
        // no OR args, no DNF transform needed
        return this;
      }
    },
    function toMQL() {
      var mqlStringsArr = [];
      for ( var a in this.args ) {
        var mql = this.args[a].toMQL ? this.args[a].toMQL() : '<UNKNOWN MQL>';
        mqlStringsArr.push(mql);
      }
      return mqlStringsArr.join(' AND ');
    }
  ]
});
