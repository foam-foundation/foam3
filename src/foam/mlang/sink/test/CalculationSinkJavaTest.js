/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink.test',
  name: 'CalculationSinkJavaTest',
  extends: 'foam.core.test.Test',

  documentation: 'Java tests for CalculationSink - tests aggregate-level mathematical operations on sink results',

  javaImports: [
    'foam.mlang.sink.CalculationSink',
    'foam.mlang.sink.CalculationOperation',
    'foam.mlang.sink.ArithmeticOperation',
    'foam.mlang.sink.Sum',
    'foam.mlang.sink.Count',
    'foam.mlang.sink.FilteredSink',
    'static foam.mlang.MLang.*'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        testBasicAddition(x);
        testBasicSubtraction(x);
        testOperatorPrecedence(x);
        testDivision(x);
        testDivisionByZero(x);
        testEmptyOperations(x);
        testSingleOperation(x);
        testNestedCalculationSink(x);
        testReset(x);
        testComplexExpression(x);
      `
    },
    {
      name: 'testBasicAddition',
      args: 'foam.lang.X x',
      javaCode: `
        // Test: 100 + 200 = 300
        Sum sum1 = new Sum();
        Sum sum2 = new Sum();
        sum1.setValue(100.0);
        sum2.setValue(200.0);

        CalculationSink calc = new CalculationSink.Builder(x)
          .setEvaluateAtRowLevel(false)
          .setOperations(new CalculationOperation[] {
            new CalculationOperation.Builder(x)
              .setOperand(sum1)
              .setOperation(ArithmeticOperation.ADD)
              .build(),
            new CalculationOperation.Builder(x)
              .setOperand(sum2)
              .setOperation(ArithmeticOperation.ADD)
              .build()
          })
          .build();

        calc.eof();
        test(calc.getValue() == 300.0, "Basic addition: 100 + 200 = " + calc.getValue() + " (expected 300)");
      `
    },
    {
      name: 'testBasicSubtraction',
      args: 'foam.lang.X x',
      javaCode: `
        // Test: 500 - 200 = 300
        // Note: operations[0].operation defines how values[0] combines with values[1]
        Sum sum1 = new Sum();
        Sum sum2 = new Sum();
        sum1.setValue(500.0);
        sum2.setValue(200.0);

        CalculationSink calc = new CalculationSink.Builder(x)
          .setEvaluateAtRowLevel(false)
          .setOperations(new CalculationOperation[] {
            new CalculationOperation.Builder(x)
              .setOperand(sum1)
              .setOperation(ArithmeticOperation.SUBTRACT)
              .build(),
            new CalculationOperation.Builder(x)
              .setOperand(sum2)
              .setOperation(ArithmeticOperation.ADD)
              .build()
          })
          .build();

        calc.eof();
        test(calc.getValue() == 300.0, "Basic subtraction: 500 - 200 = " + calc.getValue() + " (expected 300)");
      `
    },
    {
      name: 'testOperatorPrecedence',
      args: 'foam.lang.X x',
      javaCode: `
        // Test: 10 + 5 * 6 = 40 (not 90)
        // Multiply should be evaluated before add
        Sum sum1 = new Sum();
        Sum sum2 = new Sum();
        Sum sum3 = new Sum();
        sum1.setValue(10.0);
        sum2.setValue(5.0);
        sum3.setValue(6.0);

        CalculationSink calc = new CalculationSink.Builder(x)
          .setEvaluateAtRowLevel(false)
          .setOperations(new CalculationOperation[] {
            new CalculationOperation.Builder(x)
              .setOperand(sum1)
              .setOperation(ArithmeticOperation.ADD)
              .build(),
            new CalculationOperation.Builder(x)
              .setOperand(sum2)
              .setOperation(ArithmeticOperation.MULTIPLY)
              .build(),
            new CalculationOperation.Builder(x)
              .setOperand(sum3)
              .setOperation(ArithmeticOperation.ADD)
              .build()
          })
          .build();

        calc.eof();
        // Expected: 10 + (5 * 6) = 10 + 30 = 40
        test(calc.getValue() == 40.0, "Operator precedence: 10 + 5 * 6 = " + calc.getValue() + " (expected 40, not 90)");
      `
    },
    {
      name: 'testDivision',
      args: 'foam.lang.X x',
      javaCode: `
        // Test: 100 / 4 = 25
        // Note: operations[0].operation defines how values[0] combines with values[1]
        Sum sum1 = new Sum();
        Sum sum2 = new Sum();
        sum1.setValue(100.0);
        sum2.setValue(4.0);

        CalculationSink calc = new CalculationSink.Builder(x)
          .setEvaluateAtRowLevel(false)
          .setOperations(new CalculationOperation[] {
            new CalculationOperation.Builder(x)
              .setOperand(sum1)
              .setOperation(ArithmeticOperation.DIVIDE)
              .build(),
            new CalculationOperation.Builder(x)
              .setOperand(sum2)
              .setOperation(ArithmeticOperation.ADD)
              .build()
          })
          .build();

        calc.eof();
        test(calc.getValue() == 25.0, "Division: 100 / 4 = " + calc.getValue() + " (expected 25)");
      `
    },
    {
      name: 'testDivisionByZero',
      args: 'foam.lang.X x',
      javaCode: `
        // Division by zero should return 0 (implementation choice)
        // Note: operations[0].operation defines how values[0] combines with values[1]
        Sum sum1 = new Sum();
        Sum sum2 = new Sum();
        sum1.setValue(100.0);
        sum2.setValue(0.0);

        CalculationSink calc = new CalculationSink.Builder(x)
          .setEvaluateAtRowLevel(false)
          .setOperations(new CalculationOperation[] {
            new CalculationOperation.Builder(x)
              .setOperand(sum1)
              .setOperation(ArithmeticOperation.DIVIDE)
              .build(),
            new CalculationOperation.Builder(x)
              .setOperand(sum2)
              .setOperation(ArithmeticOperation.ADD)
              .build()
          })
          .build();

        calc.eof();
        test(calc.getValue() == 0.0, "Division by zero returns 0: " + calc.getValue());
      `
    },
    {
      name: 'testEmptyOperations',
      args: 'foam.lang.X x',
      javaCode: `
        // Empty operations array should return 0
        CalculationSink calc = new CalculationSink.Builder(x)
          .setEvaluateAtRowLevel(false)
          .setOperations(new CalculationOperation[] {})
          .build();

        calc.eof();
        test(calc.getValue() == 0.0, "Empty operations returns 0: " + calc.getValue());
      `
    },
    {
      name: 'testSingleOperation',
      args: 'foam.lang.X x',
      javaCode: `
        // Single operation returns the operand value
        Sum sum1 = new Sum();
        sum1.setValue(42.0);

        CalculationSink calc = new CalculationSink.Builder(x)
          .setEvaluateAtRowLevel(false)
          .setOperations(new CalculationOperation[] {
            new CalculationOperation.Builder(x)
              .setOperand(sum1)
              .setOperation(ArithmeticOperation.ADD)
              .build()
          })
          .build();

        calc.eof();
        test(calc.getValue() == 42.0, "Single operation returns operand value: " + calc.getValue() + " (expected 42)");
      `
    },
    {
      name: 'testNestedCalculationSink',
      args: 'foam.lang.X x',
      javaCode: `
        // Test nested CalculationSink: outer(inner(50 + 50) + 100) = 200
        Sum sum1 = new Sum();
        Sum sum2 = new Sum();
        Sum sum3 = new Sum();
        sum1.setValue(50.0);
        sum2.setValue(50.0);
        sum3.setValue(100.0);

        // Inner calculation: 50 + 50 = 100
        CalculationSink innerCalc = new CalculationSink.Builder(x)
          .setEvaluateAtRowLevel(false)
          .setOperations(new CalculationOperation[] {
            new CalculationOperation.Builder(x)
              .setOperand(sum1)
              .setOperation(ArithmeticOperation.ADD)
              .build(),
            new CalculationOperation.Builder(x)
              .setOperand(sum2)
              .setOperation(ArithmeticOperation.ADD)
              .build()
          })
          .build();

        innerCalc.eof();

        // Outer calculation: inner(100) + 100 = 200
        CalculationSink outerCalc = new CalculationSink.Builder(x)
          .setEvaluateAtRowLevel(false)
          .setOperations(new CalculationOperation[] {
            new CalculationOperation.Builder(x)
              .setOperand(innerCalc)
              .setOperation(ArithmeticOperation.ADD)
              .build(),
            new CalculationOperation.Builder(x)
              .setOperand(sum3)
              .setOperation(ArithmeticOperation.ADD)
              .build()
          })
          .build();

        outerCalc.eof();
        test(outerCalc.getValue() == 200.0, "Nested CalculationSink: (50+50) + 100 = " + outerCalc.getValue() + " (expected 200)");
      `
    },
    {
      name: 'testReset',
      args: 'foam.lang.X x',
      javaCode: `
        // Reset should clear the value
        Sum sum1 = new Sum();
        sum1.setValue(100.0);

        CalculationSink calc = new CalculationSink.Builder(x)
          .setEvaluateAtRowLevel(true)
          .setOperations(new CalculationOperation[] {
            new CalculationOperation.Builder(x)
              .setOperand(sum1)
              .setOperation(ArithmeticOperation.ADD)
              .build()
          })
          .build();

        calc.setValue(999.0);
        calc.reset(null);
        test(calc.getValue() == 0.0, "Reset sets value to 0: " + calc.getValue());
      `
    },
    {
      name: 'testComplexExpression',
      args: 'foam.lang.X x',
      javaCode: `
        // Test: 100 + 20 * 3 - 10 / 2 = 100 + 60 - 5 = 155
        Sum sum1 = new Sum();
        Sum sum2 = new Sum();
        Sum sum3 = new Sum();
        Sum sum4 = new Sum();
        Sum sum5 = new Sum();
        sum1.setValue(100.0);
        sum2.setValue(20.0);
        sum3.setValue(3.0);
        sum4.setValue(10.0);
        sum5.setValue(2.0);

        CalculationSink calc = new CalculationSink.Builder(x)
          .setEvaluateAtRowLevel(false)
          .setOperations(new CalculationOperation[] {
            new CalculationOperation.Builder(x)
              .setOperand(sum1)
              .setOperation(ArithmeticOperation.ADD)
              .build(),
            new CalculationOperation.Builder(x)
              .setOperand(sum2)
              .setOperation(ArithmeticOperation.MULTIPLY)
              .build(),
            new CalculationOperation.Builder(x)
              .setOperand(sum3)
              .setOperation(ArithmeticOperation.SUBTRACT)
              .build(),
            new CalculationOperation.Builder(x)
              .setOperand(sum4)
              .setOperation(ArithmeticOperation.DIVIDE)
              .build(),
            new CalculationOperation.Builder(x)
              .setOperand(sum5)
              .setOperation(ArithmeticOperation.ADD)
              .build()
          })
          .build();

        calc.eof();
        // Expected: 100 + (20 * 3) - (10 / 2) = 100 + 60 - 5 = 155
        test(calc.getValue() == 155.0, "Complex expression: 100 + 20*3 - 10/2 = " + calc.getValue() + " (expected 155)");
      `
    }
  ]
});
