/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang',
  name: 'Formula',
  extends: 'foam.mlang.AbstractExpr',
  abstract: true,

  documentation: 'Formula base-class',

  javaImports: [
    'foam.mlang.Expr',
    'java.util.ArrayList',
    'java.util.List'
  ],

  requires: [
    'foam.mlang.Constant'
  ],

  properties: [
    {
      class: 'foam.mlang.ExprArrayProperty',
      name: 'args'
    },
    {
      class: 'Boolean',
      name: 'rounding'
    }
  ],

  methods: [
    {
      name: 'f',
      javaCode: `
      Double result = null;
      try {
        for ( int i = 0; i < getArgs().length; i++) {
          var current = getArgs()[i].f(obj);
          if ( current == null ) {
            return null;
          }
          if ( current instanceof Number ) {
            var oldResult = result;
            var value = ((Number) current).doubleValue();
            result = result == null ? value : reduce(result, value);

            if ( ! Double.isFinite(result) ) {
              var formula = getClass().getSimpleName() + "(" + oldResult + ", " + value + ")";
              throw new RuntimeException("Failed to evaluate formula:" +
                formula + ", result:" + result);
            }
          }
        }
        if ( result == null )
          return null;
        return getRounding() ? Math.round(result) : result;
      } catch (Throwable t) {
        foam.core.logger.Logger logger = foam.core.logger.StdoutLogger.instance();
        logger.warning("Formula,f,result", result, this.toString(), t);
        for ( int i = 0; i < getArgs().length; i++) {
          logger.warning("Formula,f,arg", i, "arg", getArgs()[i]);
          var current = getArgs()[i].f(obj);
          logger.warning("Formula,f,arg", i, "current", current);
        }
        throw new RuntimeException(t);
      }
      `,
      code: function(o) {
        var result = null;
        for ( var i = 0 ; i < this.args.length ; i++ ) {
          var current = typeof this.args[i] === 'number' ? this.args[i] : this.args[i].f(o);
          if ( typeof current === 'number' ) {
            var oldResult = result;
            result = result === null ? current : this.reduce(result, current);

            if ( ! isFinite(result) ) {
              var formula = this.cls_.name + '(' + oldResult + ', ' + current + ')';
              throw new Error('Failed to evaluate formula:' + formula + ', result: ' + result);
            }
          }
        }

        foam.assert(result !== null, 'Formula ' + this.toString() + ' result is null.');
        return this.rounding ? Math.round(result) : result;
      }
    },
    {
      name: 'reduce',
      type: 'Double',
      abstract: true,
      args: [
        { name: 'accumulator', type: 'Double' },
        { name: 'currentValue', type: 'Double' }
      ]
    },
    {
      name: 'partialEval',
      type: 'foam.mlang.Expr',
      code: function() {
        if ( this.args.length === 0 ) return this;
        if ( this.args.length === 1 ) return this.args[0].partialEval?.() || this.args[0];

        var valList = [];
        var argList = [];
        for ( var i = 0; i < this.args.length; i++ ) {
          var arg = this.args[i];
          if ( arg.partialEval               ) arg = arg.partialEval();
          if ( this.Constant.isInstance(arg) ) arg = parseFloat(arg.f(this));

          if ( typeof arg === 'number' ) {
            valList.push(arg);
          } else {
            argList.push(arg);
          }
        }

        // reduce the valList result
        if ( valList.length > 0 ) {
          var result = valList.reduce(this.reduce);
          if ( ! isFinite(result) )
            return this.Constant.create({ value: result });

          if ( argList.length === 0 )
            return this.Constant.create({ value: this.rounding ? Math.round(result) : result });

          // append valList result to the un-resolvable argList
          argList.push(this.Constant.create({ value: result }));
        }
        return this.cls_.create({ rounding: this.rounding, args: argList });
      },
      javaCode: `
        if ( getArgs().length == 0 ) return this;
        if ( getArgs().length == 1 ) return getArgs()[0].partialEval();

        List<Double> valList = new ArrayList<>();
        List<Expr>   argList = new ArrayList<>();
        for ( var arg : getArgs() ) {
          arg = arg.partialEval();
          if ( arg instanceof Constant ) {
            var value = ((Number) arg.f(this)).doubleValue();
            valList.add(value);
          } else {
            argList.add(arg);
          }
        }

        var result = valList.stream().reduce(this::reduce);
        if ( result.isPresent() ) {
          var value = result.get();

          // Early return if the reduce result is Infinity or NaN since continue
          // performing arithmetic operations on Infinity or NaN will still
          // yield Infinity or NaN.
          if ( ! Double.isFinite(value) ) return new Constant(value);

          // Return reduce result as a constant if no un-resolvable args
          if ( argList.isEmpty() ) return new Constant(getRounding() ? Math.round(value) : value);

          // There are un-resolvable args so adding reduce result as constant.
          // Eg. Add(1,2,3, prop1, 4,5) will become Add(prop1, 15).
          argList.add(new Constant(value));
        }

        // Construct new formula with partially evaled arg list
        try {
          var nu = (Formula) getClass().getDeclaredConstructor().newInstance();
          nu.setRounding(getRounding());
          nu.setArgs(argList.toArray(new Expr[argList.size()]));
          return nu;
        } catch (Throwable e) {
          return this;
        }
      `
    },
    {
      name: 'toString',
      type: 'String',
      javaCode: `
        StringBuilder sb = new StringBuilder();
        sb.append(getClass().getSimpleName()).append('(');
        for ( int i = 0; i < getArgs().length; i++ ) {
          if ( i > 0 ) sb.append(", ");
          Object arg = getArgs()[i];
          sb.append(arg != null ? arg.toString() : "null");
        }
        sb.append(')');
        return sb.toString();
      `,
      code: function() {
        return this.cls_.name + '(' + this.args.map(a => a.toString()) + ')';
      }
    }
  ]
})
