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

             let testDate = (d) => {
                return new Date(Date.UTC.apply(null, d));
             };
             let testToday = (inc) => {
                    let d = new Date();
                    let year  = d.getFullYear();
                    let month = d.getMonth();
                    let date  = d.getDate(); 
                    date += inc;
                    return testDate([year, month, date]);
             };
/*
            // Date format tests
            x.test(this.isValidSymbol('date', '2025-01-01', [testDate([2025, 0, 1]), testDate([2025, 0, 2])].toString()), 'Test ISO date YYYY-MM-DD');
            x.test(this.isValidSymbol('date', '25/01/01', [testDate([2025, 0, 1]), testDate([2025, 0, 2])].toString()), 'Test short date YY/MM/DD');
            x.test(this.isValidSymbol('date', 'TODAY', [testToday(0), testToday(1)].toString()), 'Test TODAY');
            x.test(this.isValidSymbol('date', 'TODAY+5', [testToday(5), testToday(6)].toString()), 'Test TODAY+5');
            x.test(this.isValidSymbol('date', 'TODAY-2', [testToday(-2), testToday(-1)].toString()), 'Test TODAY-2');
*/
            // Date comparison tests
            x.test(this.isValid('created=2025-01-01', 
                    'AND(GTE(foam.core.auth.User.created, ' + testDate([2025, 0, 1]).toString() +  '),LT(foam.core.auth.User.created, ' + testDate([2025, 0, 2]).toString() + '))'), 
                    'Test date equality');
            x.test(this.isValid('created = 2025-05-31', 
                    'AND(GTE(foam.core.auth.User.created, ' + testDate([2025, 4, 31]).toString() +  '),LT(foam.core.auth.User.created, ' + testDate([2025, 5, 1]).toString() + '))'), 
                    'Test date equality');
            x.test(this.isValid('lastModified > TODAY-7', 
                    'GT(foam.core.auth.User.lastModified, ' + testToday(-6).toString() + ')'), 
                    'Test relative date comparison');

            // Number symbol tests
            x.test(this.isValidSymbol('number', "11",     "11"), "Test1: The number is 11");
            x.test(this.isValidSymbol('numbers', "1, 2, 3", "1,2,3"), "Test2: The numbers 1, 2, 3");
            x.test(this.isValidSymbol('numberArray', "1)",     "1"), "Test3: The number array (1)");  
            x.test(this.isValidSymbol('numberArray', "1,2, 3)", "1,2,3"), "Test4: The number array (1,2,3)");

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
            x.test(this.isValid("id=16 AND id<9", "AND(EQ(foam.core.auth.User.id, 16),LT(foam.core.auth.User.id, 9))"), "Test13: The id equal to the value and less than another value");
            x.test(this.isValid("id=18 OR id<9", 'OR(EQ(foam.core.auth.User.id, 18),LT(foam.core.auth.User.id, 9))'), "Test14: The id equal to the value or less than another value");

            // Enum properties tests
            x.test(this.isValid("lifecycleState= ACTIVE", "EQ(foam.core.auth.User.lifecycleState, ACTIVE)"), "Test15: The status equal to the value");
            x.test(this.isValid("lifecycleState!=ACTIVE", "NEQ(foam.core.auth.User.lifecycleState, ACTIVE)"), "Test16: The status not equal to the value");
            x.test(this.isValid("lifecycleState IN (ACTIVE,REJECTED)", "IN(foam.core.auth.User.lifecycleState, [ACTIVE, REJECTED])"), "Test17: The status exactly matches any of the listed values");
            x.test(this.isValid("lifecycleState NOT IN ( ACTIVE, REJECTED )", "NOT(IN(foam.core.auth.User.lifecycleState, [ACTIVE, REJECTED]))"), "Test18: The status does not exactly match any of the listed values");

            // Boolean properties tests
            x.test(this.isValid(" loginEnabled IS TRUE", "EQ(foam.core.auth.User.loginEnabled, true)"), "Test19: The enabled is true");
            x.test(this.isValid(" loginEnabled IS FALSE", "EQ(foam.core.auth.User.loginEnabled, false)"), "Test20: The enabled is false");

            // Parentheses tests
            x.test(this.isValid("( id = 6 )", "EQ(foam.core.auth.User.id, 6)"), "Test21: The id equal to the value with parentheses");
            x.test(this.isValid(" (id=17 AND id<9) ", "AND(EQ(foam.core.auth.User.id, 17),LT(foam.core.auth.User.id, 9))"), "Test22: The id equal to the value and less than another value with parentheses");
            x.test(this.isValid(" (id=18 OR id<10) ", 'OR(EQ(foam.core.auth.User.id, 18),LT(foam.core.auth.User.id, 10))'), "Test23: The id equal to the value or less than another value with parentheses");
  


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
