/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink.test',
  name: 'CalculationSinkTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'Comprehensive tests for CalculationSink',

  requires: [
    'foam.dao.MDAO',
    'foam.mlang.sink.CalculationSink',
    'foam.mlang.sink.CalculationOperation',
    'foam.mlang.sink.ArithmeticOperation',
    'foam.mlang.sink.Sum',
    'foam.mlang.sink.Count',
    'foam.mlang.sink.FilteredSink',
    'foam.mlang.sink.LabeledSink',
    'foam.mlang.sink.GroupBy'
  ],

  classes: [
    {
      name: 'Transaction',
      properties: [
        { class: 'Long', name: 'id' },
        { class: 'Double', name: 'amount' },
        { class: 'Double', name: 'fee' },
        { class: 'String', name: 'type' },
        { class: 'String', name: 'merchant' }
      ]
    }
  ],

  methods: [
    async function runTest(x) {
      var self = this;
      var Transaction = this.Transaction;
      var EQ = foam.mlang.predicate.Eq;

      // Setup test DAO
      var dao = this.MDAO.create({ of: Transaction });

      // Add test data
      await dao.put(this.Transaction.create({ id: 1, amount: 100, fee: 10, type: 'credit', merchant: 'A' }));
      await dao.put(this.Transaction.create({ id: 2, amount: 200, fee: 20, type: 'credit', merchant: 'A' }));
      await dao.put(this.Transaction.create({ id: 3, amount: 50, fee: 5, type: 'debit', merchant: 'A' }));
      await dao.put(this.Transaction.create({ id: 4, amount: 150, fee: 15, type: 'credit', merchant: 'B' }));
      await dao.put(this.Transaction.create({ id: 5, amount: 75, fee: 8, type: 'debit', merchant: 'B' }));

      // Run all test methods
      await this.testBasicAddition(x, dao, Transaction);
      await this.testBasicSubtraction(x, dao, Transaction);
      await this.testOperatorPrecedence(x, dao, Transaction);
      await this.testRowLevelCalculation(x, dao, Transaction);
      await this.testFilteredSinkIntegration(x, dao, Transaction, EQ);
      await this.testGroupByIntegration(x, dao, Transaction, EQ);
      await this.testEmptyOperations(x, dao);
      await this.testSingleOperation(x, dao, Transaction);
      await this.testDivisionByZero(x, Transaction);
      await this.testToString(x, Transaction);
      await this.testReset(x, dao, Transaction);
    },

    async function testBasicAddition(x, dao, Transaction) {
      // Test: SUM(amount) + SUM(fee) = 575 + 58 = 633
      var calcSink = this.CalculationSink.create({
        evaluateAtRowLevel: false,
        operations: [
          this.CalculationOperation.create({
            operand: this.Sum.create({ arg1: Transaction.AMOUNT }),
            operation: this.ArithmeticOperation.ADD
          }),
          this.CalculationOperation.create({
            operand: this.Sum.create({ arg1: Transaction.FEE }),
            operation: this.ArithmeticOperation.ADD
          })
        ]
      });

      await dao.select(calcSink);
      x.test(calcSink.value === 633, 'Basic addition: SUM(amount) + SUM(fee) = ' + calcSink.value + ' (expected 633)');
    },

    async function testBasicSubtraction(x, dao, Transaction) {
      // Test: SUM(amount) - SUM(fee) = 575 - 58 = 517
      // Note: operations[0].operation defines how values[0] combines with values[1]
      var calcSink = this.CalculationSink.create({
        evaluateAtRowLevel: false,
        operations: [
          this.CalculationOperation.create({
            operand: this.Sum.create({ arg1: Transaction.AMOUNT }),
            operation: this.ArithmeticOperation.SUBTRACT
          }),
          this.CalculationOperation.create({
            operand: this.Sum.create({ arg1: Transaction.FEE }),
            operation: this.ArithmeticOperation.ADD
          })
        ]
      });

      await dao.select(calcSink);
      x.test(calcSink.value === 517, 'Basic subtraction: SUM(amount) - SUM(fee) = ' + calcSink.value + ' (expected 517)');
    },

    async function testOperatorPrecedence(x, dao, Transaction) {
      // Test: a + b * c should be a + (b * c), not (a + b) * c
      // SUM(amount) + COUNT * SUM(fee)
      // = 575 + 5 * 58 = 575 + 290 = 865 (with precedence)
      // vs (575 + 5) * 58 = 33640 (without precedence)
      //
      // Operation pattern: ops[i] = operations[i].operation defines how values[i] combines with values[i+1]
      // So: 575 ADD 5 MUL 58 means ops = [ADD, MUL]
      var calcSink = this.CalculationSink.create({
        evaluateAtRowLevel: false,
        operations: [
          this.CalculationOperation.create({
            operand: this.Sum.create({ arg1: Transaction.AMOUNT }),
            operation: this.ArithmeticOperation.ADD
          }),
          this.CalculationOperation.create({
            operand: this.Count.create(),
            operation: this.ArithmeticOperation.MULTIPLY
          }),
          this.CalculationOperation.create({
            operand: this.Sum.create({ arg1: Transaction.FEE }),
            operation: this.ArithmeticOperation.ADD
          })
        ]
      });

      await dao.select(calcSink);
      x.test(calcSink.value === 865, 'Operator precedence: SUM(amount) + COUNT * SUM(fee) = ' + calcSink.value + ' (expected 865, not 33640)');
    },

    async function testRowLevelCalculation(x, dao, Transaction) {
      // Test row-level: sum of (amount - fee) for each row
      // Row 1: 100 - 10 = 90
      // Row 2: 200 - 20 = 180
      // Row 3: 50 - 5 = 45
      // Row 4: 150 - 15 = 135
      // Row 5: 75 - 8 = 67
      // Total: 517
      //
      // Note: operations[0].operation defines how values[0] combines with values[1]
      var calcSink = this.CalculationSink.create({
        evaluateAtRowLevel: true,
        operations: [
          this.CalculationOperation.create({
            operand: Transaction.AMOUNT,
            operation: this.ArithmeticOperation.SUBTRACT
          }),
          this.CalculationOperation.create({
            operand: Transaction.FEE,
            operation: this.ArithmeticOperation.ADD
          })
        ]
      });

      await dao.select(calcSink);
      x.test(calcSink.value === 517, 'Row-level: sum of (amount - fee) = ' + calcSink.value + ' (expected 517)');
    },

    async function testFilteredSinkIntegration(x, dao, Transaction, EQ) {
      // Test: SUM(credits) - SUM(debits)
      // Credits: 100 + 200 + 150 = 450
      // Debits: 50 + 75 = 125
      // Result: 450 - 125 = 325
      //
      // Note: operations[0].operation defines how values[0] combines with values[1]
      var calcSink = this.CalculationSink.create({
        evaluateAtRowLevel: false,
        operations: [
          this.CalculationOperation.create({
            operand: this.FilteredSink.create({
              predicate: EQ.create({ arg1: Transaction.TYPE, arg2: 'credit' }),
              delegate: this.Sum.create({ arg1: Transaction.AMOUNT })
            }),
            operation: this.ArithmeticOperation.SUBTRACT
          }),
          this.CalculationOperation.create({
            operand: this.FilteredSink.create({
              predicate: EQ.create({ arg1: Transaction.TYPE, arg2: 'debit' }),
              delegate: this.Sum.create({ arg1: Transaction.AMOUNT })
            }),
            operation: this.ArithmeticOperation.ADD
          })
        ]
      });

      await dao.select(calcSink);
      x.test(calcSink.value === 325, 'FilteredSink: credits - debits = ' + calcSink.value + ' (expected 325)');
    },

    async function testGroupByIntegration(x, dao, Transaction, EQ) {
      // Test: GroupBy merchant, calculate credits - debits per merchant
      // Merchant A: credits (100+200=300) - debits (50) = 250
      // Merchant B: credits (150) - debits (75) = 75

      var groupBy = this.GroupBy.create({
        arg1: Transaction.MERCHANT,
        arg2: this.CalculationSink.create({
          evaluateAtRowLevel: false,
          operations: [
            this.CalculationOperation.create({
              operand: this.FilteredSink.create({
                predicate: EQ.create({ arg1: Transaction.TYPE, arg2: 'credit' }),
                delegate: this.Sum.create({ arg1: Transaction.AMOUNT })
              }),
              operation: this.ArithmeticOperation.SUBTRACT
            }),
            this.CalculationOperation.create({
              operand: this.FilteredSink.create({
                predicate: EQ.create({ arg1: Transaction.TYPE, arg2: 'debit' }),
                delegate: this.Sum.create({ arg1: Transaction.AMOUNT })
              }),
              operation: this.ArithmeticOperation.ADD
            })
          ]
        })
      });

      await dao.select(groupBy);

      var merchantA = groupBy.groups['A'];
      var merchantB = groupBy.groups['B'];

      x.test(merchantA && merchantA.value === 250, 'GroupBy merchant A: credits - debits = ' + (merchantA ? merchantA.value : 'undefined') + ' (expected 250)');
      x.test(merchantB && merchantB.value === 75, 'GroupBy merchant B: credits - debits = ' + (merchantB ? merchantB.value : 'undefined') + ' (expected 75)');
    },

    async function testEmptyOperations(x, dao) {
      // Test with empty operations array
      var calcSink = this.CalculationSink.create({
        evaluateAtRowLevel: false,
        operations: []
      });

      await dao.select(calcSink);
      x.test(calcSink.value === 0, 'Empty operations returns 0: ' + calcSink.value);
    },

    async function testSingleOperation(x, dao, Transaction) {
      // Test with single operation (no actual calculation needed)
      var calcSink = this.CalculationSink.create({
        evaluateAtRowLevel: false,
        operations: [
          this.CalculationOperation.create({
            operand: this.Sum.create({ arg1: Transaction.AMOUNT }),
            operation: this.ArithmeticOperation.ADD
          })
        ]
      });

      await dao.select(calcSink);
      x.test(calcSink.value === 575, 'Single operation: SUM(amount) = ' + calcSink.value + ' (expected 575)');
    },

    async function testDivisionByZero(x, Transaction) {
      // Create a DAO with zero sum for division test
      var emptyDao = this.MDAO.create({ of: Transaction });
      await emptyDao.put(Transaction.create({ id: 1, amount: 100, fee: 0, type: 'credit', merchant: 'A' }));

      // Note: operations[0].operation defines how values[0] combines with values[1]
      var calcSink = this.CalculationSink.create({
        evaluateAtRowLevel: false,
        operations: [
          this.CalculationOperation.create({
            operand: this.Sum.create({ arg1: Transaction.AMOUNT }),
            operation: this.ArithmeticOperation.DIVIDE
          }),
          this.CalculationOperation.create({
            operand: this.Sum.create({ arg1: Transaction.FEE }),
            operation: this.ArithmeticOperation.ADD
          })
        ]
      });

      await emptyDao.select(calcSink);
      // Division by zero should return 0 (as per implementation)
      x.test(calcSink.value === 0, 'Division by zero returns 0: ' + calcSink.value);
    },

    async function testToString(x, Transaction) {
      var calcSink = this.CalculationSink.create({
        evaluateAtRowLevel: false,
        operations: [
          this.CalculationOperation.create({
            operand: this.Sum.create({ arg1: Transaction.AMOUNT }),
            operation: this.ArithmeticOperation.SUBTRACT
          }),
          this.CalculationOperation.create({
            operand: this.Sum.create({ arg1: Transaction.FEE }),
            operation: this.ArithmeticOperation.ADD
          })
        ]
      });

      var str = calcSink.toString();
      x.test(str.indexOf('CALC(') === 0, 'toString starts with CALC(: ' + str);
      x.test(str.indexOf('-') > 0, 'toString contains operator: ' + str);
    },

    async function testReset(x, dao, Transaction) {
      var calcSink = this.CalculationSink.create({
        evaluateAtRowLevel: true,
        operations: [
          this.CalculationOperation.create({
            operand: Transaction.AMOUNT,
            operation: this.ArithmeticOperation.ADD
          })
        ]
      });

      // First select
      await dao.select(calcSink);
      var firstValue = calcSink.value;

      // Reset and select again
      calcSink.reset();
      x.test(calcSink.value === 0, 'Reset sets value to 0');

      await dao.select(calcSink);
      x.test(calcSink.value === firstValue, 'After reset, re-select gives same result: ' + calcSink.value + ' (expected ' + firstValue + ')');
    }
  ]
});
