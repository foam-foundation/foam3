/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'foam.parse.test',
    name: 'SimpleQueryParserTest',
    extends: 'foam.core.test.JSTest',

    requires: [ 'foam.parse.SimpleQueryParser'],

    methods: [
        function runTest(x) {
            debugger;

            // Number symbol tests
            x.test(this.isValidSymbol('number', "1",     "1"), "Test1: The number 1");
            x.test(this.isValidSymbol('numbers', "1, 2, 3", "1,2,3"), "Test2: The numbers 1, 2, 3");
            x.test(this.isValidSymbol('numberArray', "(1)",     "1"), "Test3: The number array (1)");
            x.test(this.isValidSymbol('numberArray', "(1,2, 3)", "1,2,3"), "Test4: The number array (1,2,3)");

            // Number properties tests
            x.test(this.isValid("id = 6", "EQ(foam.core.auth.User.id, 6)"), "Test5: The id equal to the value");
            x.test(this.isValid("id!=6", "NEQ(foam.core.auth.User.id, 6)"), "Test6: The id not equal to the value");
            x.test(this.isValid("id>6", "GT(foam.core.auth.User.id, 6)"), "Test7: The id greater than the value");
            x.test(this.isValid("id>=6", "GTE(foam.core.auth.User.id, 6)"), "Test8: The id greater than or equal to the value");
            x.test(this.isValid("id<6", "LT(foam.core.auth.User.id, 6)"), "Test9: The id less than the value");
            x.test(this.isValid("id<=6", "LTE(foam.core.auth.User.id, 6)"), "test10: The id less than or equal to the value");
            x.test(this.isValid("id IN (6,7,8)", "IN(foam.core.auth.User.id, [6, 7, 8])"), "Test11: The id exactly matches any of the listed values");
            x.test(this.isValid('id NOT IN (6,7,8)', 'NOT(IN(foam.core.auth.User.id, [6, 7, 8]))'), 'Test12: The id does not exactly match any of the listed values');

            // Number combined properties tests
            x.test(this.isValid("id=6 AND id<9", "AND(EQ(foam.core.auth.User.id, 6),LT(foam.core.auth.User.id, 9))"), "Test13: The id equal to the value and less than another value");
            x.test(this.isValid("id=6 OR id<9", 'OR(EQ(foam.core.auth.User.id, 6),LT(foam.core.auth.User.id, 9))'), "Test14: The id equal to the value or less than another value");

            // Enum properties tests
            x.test(this.isValid("lifecycleState= ACTIVE", "EQ(foam.core.auth.User.lifecycleState, ACTIVE)"), "Test15: The status equal to the value");
      
            x.test(this.isValid("lifecycleState!=ACTIVE", "NEQ(foam.core.auth.User.lifecycleState, ACTIVE)"), "Test16: The status not equal to the value");
            x.test(this.isValid("lifecycleState IN (ACTIVE,REJECTED)", "IN(foam.core.auth.User.lifecycleState, [ACTIVE, REJECTED])"), "Test17: The status exactly matches any of the listed values");

            x.test(this.isValid("lifecycleState NOT IN ( ACTIVE , REJECTED )", "NOT(IN(foam.core.auth.User.lifecycleState, [ACTIVE, REJECTED]))"), "Test18: The status does not exactly match any of the listed values");

            // Boolean properties tests
            x.test(this.isValid(" loginEnabled IS TRUE", "EQ(foam.core.auth.User.loginEnabled, true)"), "Test19: The enabled is true");
            x.test(this.isValid(" loginEnabled IS FALSE", "EQ(foam.core.auth.User.loginEnabled, false)"), "Test20: The enabled is false");
   

        },
        function buildPredicate(query) {
            // Assuming foam.parse.SimpleQueryParser.parse returns a predicate object
            let parser = this.SimpleQueryParser.create({of: foam.core.auth.User});
            let predicate = parser.parseString(query);
            return predicate || null;
        }, 
        function isValidSymbol(symbolName, input, expectedOutput) {
            let parser = this.SimpleQueryParser.create({of: foam.core.auth.User});
            let result = parser.parseString(input, symbolName);
            if (result == null) return false;
            console.log("Result: " + result.toString() + ", Expected: " + expectedOutput);
            return result.toString().trim().toLowerCase() === expectedOutput.toString().trim().toLowerCase();
        } ,      
        function isValid(query, statement) {
            let result = this.buildPredicate(query);
            if (result == null) return false;
            console.log("Result: " + result.toString() + ", Expected: " + statement);
            // Assuming result.partialEval() returns a simplified predicate
            result = result.partialEval ? result.partialEval() : result;
            return statement.trim().toLowerCase() === result.toString().trim().toLowerCase();
        },
        function evaluate(query, user) {
            var predicate = this.buildPredicate(query);
            if (predicate == null) return false;
            // Assuming predicate.f(user) evaluates the predicate against the user
            return predicate.f ? predicate.f(user) : false;
        }
    ]
});
