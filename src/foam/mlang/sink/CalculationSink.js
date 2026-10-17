/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'CalculationSink',
  extends: 'foam.dao.AbstractSink',
  implements: [ 'foam.lang.Serializable', 'foam.mlang.sink.Reducible' ],

  documentation: `A sink that performs mathematical operations on values from other sinks.
    Supports complex chained operations like: var1 + var2 - var3 * var4
    Can operate at row-level (per object) or total-level (after EOF).

    Example usage:
    // Total level: Calculate (totalSum - reversalSum)
    CalculationSink.create({
      evaluateAtRowLevel: false,
      operations: [
        { operand: SumSink.create({arg1: AMOUNT}), operation: ADD },
        { operand: FilteredSink.create({
            predicate: IS_REVERSAL,
            delegate: SumSink.create({arg1: AMOUNT})
          }), operation: SUBTRACT }
      ]
    })

    // Row level: Calculate (price * quantity - discount) for each row
    CalculationSink.create({
      evaluateAtRowLevel: true,
      operations: [
        { operand: PRICE, operation: MULTIPLY },
        { operand: QUANTITY, operation: MULTIPLY },
        { operand: DISCOUNT, operation: SUBTRACT }
      ]
    })`,

  properties: [
    {
      class: 'Boolean',
      name: 'evaluateAtRowLevel',
      documentation: `When true, evaluates the expression for each row and accumulates the results.
        When false (default), collects data in operand sinks and evaluates the expression once at EOF.`
    },
    {
      class: 'FObjectArray',
      of: 'foam.mlang.sink.CalculationOperation',
      name: 'operations',
      documentation: 'Array of operations to chain together',
      factory: function() { return []; },
      preSet: function(_, n) {
        if ( foam.Array.isInstance(n) ) {
          return n.map(op => {
            if ( op && op.__context__ != this.__subContext__ ) {
              return op.clone(this.__subContext__);
            }
            return op;
          });
        }
        return n;
      }
    },
    {
      class: 'Double',
      name: 'value',
      documentation: 'The accumulated calculation result',
      getter: function() {
        // For total-level, recalculate from sink values on demand
        // For row-level, return the accumulated value
        if ( this.evaluateAtRowLevel ) {
          return this.instance_.value || 0;
        }
        return this.evaluateExpression_(null);
      },
      setter: function(v) {
        // For row-level, store the accumulated value
        this.instance_.value = v;
      }
    }
  ],

  methods: [
    {
      name: 'put',
      code: function(obj, s) {
        if ( this.evaluateAtRowLevel ) {
          // Calculate expression for this row and add to accumulated value
          this.value += this.evaluateExpression_(obj);
        } else {
          // Delegate to all operand sinks for total-level calculation
          this.operations.forEach(function(op) {
            if ( op.operand ) {
              op.operand.put(obj, s);
            }
          });
        }
      },
      javaCode: `
        if ( getEvaluateAtRowLevel() ) {
          setValue(getValue() + evaluateExpression_(obj));
        } else {
          for ( int i = 0; i < getOperations().length; i++ ) {
            if ( getOperations()[i] != null && getOperations()[i].getOperand() != null ) {
              Object operand = getOperations()[i].getOperand();
              if ( operand instanceof foam.dao.Sink ) {
                ((foam.dao.Sink) operand).put(obj, sub);
              }
            }
          }
        }
      `
    },
    {
      name: 'remove',
      code: function(obj, s) {
        if ( this.evaluateAtRowLevel ) {
          this.value -= this.evaluateExpression_(obj);
        } else {
          this.operations.forEach(function(op) {
            if ( op.operand && op.operand.remove ) {
              op.operand.remove(obj, s);
            }
          });
        }
      },
      javaCode: `
        if ( getEvaluateAtRowLevel() ) {
          setValue(getValue() - evaluateExpression_(obj));
        } else {
          for ( int i = 0; i < getOperations().length; i++ ) {
            if ( getOperations()[i] != null && getOperations()[i].getOperand() != null ) {
              Object operand = getOperations()[i].getOperand();
              if ( operand instanceof foam.dao.Sink ) {
                ((foam.dao.Sink) operand).remove(obj, sub);
              }
            }
          }
        }
      `
    },
    {
      name: 'eof',
      code: function() {
        // Call eof on all operand sinks first to finalize their state
        this.operations.forEach(function(op) {
          if ( op.operand && op.operand.eof ) {
            op.operand.eof();
          }
        });
        if ( ! this.evaluateAtRowLevel ) {
          // Evaluate expression once using accumulated sink values
          this.value = this.evaluateExpression_(null);
        }
      },
      javaCode: `
        // Call eof on all operand sinks first to finalize their state
        for ( int i = 0; i < getOperations().length; i++ ) {
          if ( getOperations()[i] != null && getOperations()[i].getOperand() != null ) {
            Object operand = getOperations()[i].getOperand();
            if ( operand instanceof foam.dao.Sink ) {
              ((foam.dao.Sink) operand).eof();
            }
          }
        }
        if ( ! getEvaluateAtRowLevel() ) {
          setValue(evaluateExpression_(null));
        }
      `
    },
    {
      name: 'reset',
      code: function(s) {
        this.value = 0;
        this.operations.forEach(function(op) {
          if ( op.operand && op.operand.reset ) {
            op.operand.reset(s);
          }
        });
      },
      javaCode: `
        setValue(0.0);
        for ( int i = 0; i < getOperations().length; i++ ) {
          if ( getOperations()[i] != null && getOperations()[i].getOperand() != null ) {
            Object operand = getOperations()[i].getOperand();
            if ( operand instanceof foam.dao.Sink ) {
              ((foam.dao.Sink) operand).reset(sub);
            }
          }
        }
      `
    },
    {
      name: 'evaluateExpression_',
      args: [ 'Object obj' ],
      type: 'Double',
      code: function(obj) {
        if ( ! this.operations || this.operations.length === 0 ) return 0;

        // Get all values first
        var values = this.operations.map(function(op) {
          return this.getOperandValue_(op.operand, obj);
        }.bind(this));

        // Get all operations (operations[i-1].operation applies to values[i])
        var ops = this.operations.slice(0, -1).map(function(op) {
          return op.operation;
        });

        // First pass: Handle MULTIPLY and DIVIDE (higher precedence)
        var i = 0;
        while ( i < ops.length ) {
          if ( ops[i] === foam.mlang.sink.ArithmeticOperation.MULTIPLY ) {
            values[i] = values[i] * values[i + 1];
            values.splice(i + 1, 1);
            ops.splice(i, 1);
          } else if ( ops[i] === foam.mlang.sink.ArithmeticOperation.DIVIDE ) {
            if ( values[i + 1] !== 0 ) {
              values[i] = values[i] / values[i + 1];
              values.splice(i + 1, 1);
              ops.splice(i, 1);
            } else {
              console.warn('Division by zero in CalculationSink');
              return 0;
            }
          } else {
            i++;
          }
        }

        // Second pass: Handle ADD and SUBTRACT (lower precedence)
        var result = values[0];
        for ( var j = 0; j < ops.length; j++ ) {
          if ( ops[j] === foam.mlang.sink.ArithmeticOperation.ADD ) {
            result += values[j + 1];
          } else if ( ops[j] === foam.mlang.sink.ArithmeticOperation.SUBTRACT ) {
            result -= values[j + 1];
          }
        }

        return result;
      },
      javaCode: `
        if ( getOperations() == null || getOperations().length == 0 ) return 0.0;

        // Get all values first
        java.util.List<Double> values = new java.util.ArrayList<>();
        for ( int i = 0; i < getOperations().length; i++ ) {
          values.add(getOperandValue_(getOperations()[i].getOperand(), obj));
        }

        // Get all operations
        java.util.List<foam.mlang.sink.ArithmeticOperation> ops = new java.util.ArrayList<>();
        for ( int i = 0; i < getOperations().length - 1; i++ ) {
          ops.add(getOperations()[i].getOperation());
        }

        // First pass: Handle MULTIPLY and DIVIDE
        int i = 0;
        while ( i < ops.size() ) {
          if ( ops.get(i) == foam.mlang.sink.ArithmeticOperation.MULTIPLY ) {
            values.set(i, values.get(i) * values.get(i + 1));
            values.remove(i + 1);
            ops.remove(i);
          } else if ( ops.get(i) == foam.mlang.sink.ArithmeticOperation.DIVIDE ) {
            if ( values.get(i + 1) != 0 ) {
              values.set(i, values.get(i) / values.get(i + 1));
              values.remove(i + 1);
              ops.remove(i);
            } else {
              System.err.println("Division by zero in CalculationSink");
              return 0.0;
            }
          } else {
            i++;
          }
        }

        // Second pass: Handle ADD and SUBTRACT
        double result = values.get(0);
        for ( int j = 0; j < ops.size(); j++ ) {
          if ( ops.get(j) == foam.mlang.sink.ArithmeticOperation.ADD ) {
            result += values.get(j + 1);
          } else if ( ops.get(j) == foam.mlang.sink.ArithmeticOperation.SUBTRACT ) {
            result -= values.get(j + 1);
          }
        }

        return result;
      `
    },
    {
      name: 'getOperandValue_',
      args: [ 'Object operand', 'Object obj' ],
      type: 'Double',
      code: function(operand, obj) {
        if ( ! operand ) return 0;

        if ( this.evaluateAtRowLevel ) {
          // For row-level: evaluate expressions against the object
          // Check for Expr instance or any object with an f() function (like Property axioms)
          if ( foam.mlang.Expr.isInstance(operand) || ( operand.f && typeof operand.f === 'function' ) ) {
            var val = operand.f(obj);
            return typeof val === 'number' ? val : parseFloat(val) || 0;
          }
        } else {
          // For total-level: get accumulated values from sinks
          if ( foam.dao.Sink.isInstance(operand) ) {
            return this.getSinkValue_(operand);
          }
        }

        // Fallback to numeric conversion
        return typeof operand === 'number' ? operand : parseFloat(operand) || 0;
      },
      javaCode: `
        if ( operand == null ) return 0.0;

        if ( getEvaluateAtRowLevel() ) {
          // For row-level: evaluate expressions against the object
          // Check for Expr or PropertyInfo (both have f() method)
          if ( operand instanceof foam.mlang.Expr ) {
            Object val = ((foam.mlang.Expr) operand).f(obj);
            if ( val instanceof Number ) {
              return ((Number) val).doubleValue();
            }
          } else if ( operand instanceof foam.lang.PropertyInfo ) {
            Object val = ((foam.lang.PropertyInfo) operand).f(obj);
            if ( val instanceof Number ) {
              return ((Number) val).doubleValue();
            }
          }
        } else {
          if ( operand instanceof foam.dao.Sink ) {
            return getSinkValue_((foam.dao.Sink) operand);
          }
        }

        if ( operand instanceof Number ) {
          return ((Number) operand).doubleValue();
        }

        return 0.0;
      `
    },
    {
      name: 'getSinkValue_',
      args: [ 'foam.dao.Sink sink' ],
      type: 'Double',
      code: function(sink) {
        if ( ! sink ) return 0;

        // Try to get numeric value from various sink types
        if ( sink.value !== undefined && sink.value !== null ) {
          var val = sink.value;
          // Handle nested value objects
          if ( val && val.value !== undefined ) {
            val = val.value;
          }
          return typeof val === 'number' ? val : parseFloat(val) || 0;
        }

        if ( sink.valueOf && typeof sink.valueOf === 'function' ) {
          var val = sink.valueOf();
          return typeof val === 'number' ? val : parseFloat(val) || 0;
        }

        return 0;
      },
      javaCode: `
        if ( sink == null ) return 0.0;

        try {
          if ( sink instanceof foam.mlang.sink.Sum ) {
            return ((foam.mlang.sink.Sum) sink).getValue();
          } else if ( sink instanceof foam.mlang.sink.Count ) {
            return (double) ((foam.mlang.sink.Count) sink).getValue();
          } else if ( sink instanceof foam.mlang.sink.Average ) {
            return ((foam.mlang.sink.Average) sink).getValue();
          } else if ( sink instanceof foam.mlang.sink.Min ) {
            Object minValue = ((foam.mlang.sink.Min) sink).getValue();
            if ( minValue instanceof Number ) {
              return ((Number) minValue).doubleValue();
            }
          } else if ( sink instanceof foam.mlang.sink.Max ) {
            Object maxValue = ((foam.mlang.sink.Max) sink).getValue();
            if ( maxValue instanceof Number ) {
              return ((Number) maxValue).doubleValue();
            }
          } else if ( sink instanceof foam.mlang.sink.FilteredSink ) {
            return getSinkValue_(((foam.mlang.sink.FilteredSink) sink).getDelegate());
          } else if ( sink instanceof foam.mlang.sink.LabeledSink ) {
            return getSinkValue_(((foam.mlang.sink.LabeledSink) sink).getDelegate());
          } else if ( sink instanceof foam.mlang.sink.CalculationSink ) {
            return ((foam.mlang.sink.CalculationSink) sink).getValue();
          }
        } catch (Exception e) {
          System.err.println("Error getting sink value: " + e.getMessage());
        }

        return 0.0;
      `
    },
    {
      name: 'toString',
      code: function() {
        if ( ! this.operations || this.operations.length === 0 ) return 'CALC()';

        var self = this;
        var expr = this.operations.map(function(op, i) {
          var opSymbol = '';
          if ( i > 0 ) {
            // Use the PREVIOUS operation's label since ops[i-1] determines how to combine values[i-1] with values[i]
            var prevOp = self.operations[i - 1];
            opSymbol = ' ' + (prevOp.operation ? prevOp.operation.label : '?') + ' ';
          }
          return opSymbol + (op.operand ? op.operand.toString() : 'null');
        }).join('');

        return 'CALC(' + expr + ')';
      },
      javaCode: `
        if ( getOperations() == null || getOperations().length == 0 ) return "CALC()";

        StringBuilder sb = new StringBuilder();
        sb.append("CALC(");

        for ( int i = 0; i < getOperations().length; i++ ) {
          CalculationOperation op = getOperations()[i];
          if ( i > 0 ) {
            // Use the PREVIOUS operation's label since ops[i-1] determines how to combine values[i-1] with values[i]
            CalculationOperation prevOp = getOperations()[i - 1];
            sb.append(" ").append(prevOp.getOperation().getLabel()).append(" ");
          }
          sb.append(op.getOperand() != null ? op.getOperand().toString() : "null");
        }

        sb.append(")");
        return sb.toString();
      `
    },
    {
      name: 'reduce',
      args: 'foam.mlang.sink.Reducible other',
      code: function(other) {
        if ( ! other || ! foam.mlang.sink.CalculationSink.isInstance(other) ) return;
        if ( this.evaluateAtRowLevel !== other.evaluateAtRowLevel ) return;
        if ( this.operations.length !== other.operations.length ) return;

        if ( this.evaluateAtRowLevel ) {
          // For row-level, just add the accumulated values
          this.value += other.value;
        } else {
          // For total-level, reduce each operand pair
          for ( var i = 0; i < this.operations.length; i++ ) {
            var thisOp = this.operations[i];
            var otherOp = other.operations[i];

            if ( thisOp.operand && thisOp.operand.reduce && otherOp.operand ) {
              thisOp.operand.reduce(otherOp.operand);
            }
          }
        }
      },
      javaCode: `
        if ( other == null || ! (other instanceof foam.mlang.sink.CalculationSink) ) return;

        foam.mlang.sink.CalculationSink otherCalc = (foam.mlang.sink.CalculationSink) other;

        if ( getEvaluateAtRowLevel() != otherCalc.getEvaluateAtRowLevel() ) return;
        if ( getOperations().length != otherCalc.getOperations().length ) return;

        if ( getEvaluateAtRowLevel() ) {
          setValue(getValue() + otherCalc.getValue());
        } else {
          for ( int i = 0; i < getOperations().length; i++ ) {
            Object thisOp = getOperations()[i].getOperand();
            Object otherOp = otherCalc.getOperations()[i].getOperand();

            if ( thisOp instanceof foam.mlang.sink.Reducible && otherOp instanceof foam.mlang.sink.Reducible ) {
              ((foam.mlang.sink.Reducible) thisOp).reduce((foam.mlang.sink.Reducible) otherOp);
            }
          }
        }
      `
    },

    function toSummary() {
      return this.value;
    },

    function valueOf() {
      return this.value;
    },

    function addToE(e) {
      e.add(this.value);
    },

    function toProperties() {
      return [{
        class: 'Double',
        name: 'calculation',
        label: 'Calculation'
      }];
    },

    function setPropertyValues(o, sink, ps) {
      if ( ps && ps.length > 0 ) {
        ps[0].set(o, this.value);
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'CalculationOperation',

  documentation: 'Represents a single operation in a calculation chain',

  properties: [
    {
      class: 'FObjectProperty',
      name: 'operand',
      documentation: 'The operand - can be a Sink (for total-level) or Expr (for row-level)'
    },
    {
      class: 'Enum',
      of: 'foam.mlang.sink.ArithmeticOperation',
      name: 'operation',
      value: 'ADD',
      documentation: 'The operation to apply with this operand'
    }
  ]
});


foam.ENUM({
  package: 'foam.mlang.sink',
  name: 'ArithmeticOperation',

  documentation: 'Arithmetic operations supported by CalculationSink',

  values: [
    { name: 'ADD',      label: '+', ordinal: 0 },
    { name: 'SUBTRACT', label: '-', ordinal: 1 },
    { name: 'MULTIPLY', label: '*', ordinal: 2 },
    { name: 'DIVIDE',   label: '/', ordinal: 3 }
  ]
});
