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
            //debugger;

             let testDate = (d) => {
                return new Date(Date.UTC.apply(null, d));
             };
             let testToday = (inc) => {
                    let d = new Date();
                    let year  = d.getFullYear();
                    let month = d.getMonth();
                    let date  = d.getDate(); 
                    date += inc;
                    return testDate([year, month, date, 12]);
             };

            // String symbol tests
            x.test(this.isValidSymbol('string', "SomeString", "SomeString"), "String Test1: Simple string");
            x.test(this.isValidSymbol('string', "email@somedomain.com", "email@somedomain.com"), "String Test2: String with special characters");
            x.test(this.isValidSymbol('string', '"Quoted String"', "Quoted String"), "String Test3: Quoted string");
            x.test(this.isValidSymbol('string', '"Quoted \\" String"', 'Quoted " String'), 'String Test4: Quoted string with escaped quote');
            x.test(this.isValidSymbol('string', '"Quoted , String"', 'Quoted , String'), 'String Test5: Quoted string with comma');            
            x.test(this.isValidSymbol('stringArray', 'One, Two,Three)', 'One,Two,Three'), 'String Test6: String array (One,Two,Three)');
            x.test(this.isValidSymbol('stringArray', '"One","Two","Three")', 'One,Two,Three'), 'String Test7: String array with quoted strings ( "One" , "Two" , "Three" )');

            // String properties tests
            x.test(this.isValid("firstName = SomeName", 'EQ(foam.core.auth.User.firstName, "SomeName")'), "String Test8: The name equal to the value");
            x.test(this.isValid("firstName!=SomeName", 'NEQ(foam.core.auth.User.firstName, "SomeName")'), "String Test9: The name not equal to the value");
            x.test(this.isValid("firstName CONTAINS SomeName", 'CONTAINS_IC(foam.core.auth.User.firstName, "SomeName")'), "String Test10: The name contains the value");
            x.test(this.isValid("firstName:SomeName", 'CONTAINS_IC(foam.core.auth.User.firstName, "SomeName")'), "String Test10: The name contains the value with : operator");
            x.test(this.isValid("firstName~SomeName", 'CONTAINS_IC(foam.core.auth.User.firstName, "SomeName")'), "String Test11: The name contains the value with ~ operator");
            x.test(this.isValid("firstName IN (SomeName,AnotherName)", 'IN(foam.core.auth.User.firstName, ["SomeName", "AnotherName"])'), "String Test12: The name exactly matches any of the listed values");
            x.test(this.isValid('firstName NOT IN (SomeName,AnotherName)', 'NOT(IN(foam.core.auth.User.firstName, ["SomeName", "AnotherName"]))'), 'String Test13: The name does not exactly match any of the listed values');
            x.test(this.isValid('firstName IS EMPTY', 'NOT(HAS(foam.core.auth.User.firstName))'), 'String Test14: The name is empty');
            x.test(this.isValid('firstName IS NOT EMPTY', 'HAS(foam.core.auth.User.firstName)'), 'String Test15: The name is not empty');


            // Float symbol tests
            x.test(this.isValidSymbol('float', "1.107", "1.107", true), "Float Test1: The float is 1.107");
            x.test(this.isValidSymbol('float', "-100.6", "-100.6", true), "Float Test2: The numbers -100.600");
            x.test(this.isValidSymbol('float', "113", "113.000", true), "Float Test3: The negative number is 113.000");
            x.test(this.isValidSymbol('float', "-1130", "-1130.000", true), "Float Test4: The negative number is -1130.000");

            // Date format tests
            x.test(this.isValidSymbol('date', '2025-01-01', [testDate([2025, 0, 1, 12]), testDate([2025, 0, 2, 12])].toString()), 'Date Test1: ISO date YYYY-MM-DD');
            x.test(this.isValidSymbol('date', '25/10/01', [testDate([2025, 9, 1, 12]), testDate([2025, 9, 2, 12])].toString()), 'Date Test2: Short date YY/MM/DD');
            x.test(this.isValidSymbol('date', 'TODAY', [testToday(0), testToday(1)].toString()), 'Date Test3: TODAY');
            x.test(this.isValidSymbol('date', 'TODAY+5', [testToday(5), testToday(6)].toString()), 'Date Test4: TODAY+5');
            x.test(this.isValidSymbol('date', 'TODAY-2', [testToday(-2), testToday(-1)].toString()), 'Date Test5: TODAY-2');

            // Date symbol tests with different time components
            // 1. Add hours
            x.test(this.isValidSymbol(
              'date',
              '2025-01-01T15',
              [testDate([2025, 0, 1, 15]), testDate([2025, 0, 1, 16])].toString()
            ), 'Date Test6: ISO date with hours');

            // 2. Add hours and minutes
            x.test(this.isValidSymbol(
              'date',
              '25/10/01T16:30',
              [testDate([2025, 9, 1, 16, 30]), testDate([2025, 9, 1, 16, 31])].toString()
            ), 'Date Test7: ISO date with hours and minutes');

            // 3. Add hours, minutes, and seconds
            x.test(this.isValidSymbol(
              'date',
              '2025-06-01T17:45:30',
              [testDate([2025, 5, 1, 17, 45, 30]), testDate([2025, 5, 1, 17, 45, 31])].toString()
            ), 'Date Test8: ISO date with hours, minutes and seconds');

            // 4. Add hours, minutes, seconds and milliseconds
            x.test(this.isValidSymbol(
              'date',
              '2025-06-01T18:45:30.123',
              [testDate([2025, 5, 1, 18, 45, 30, 123]), testDate([2025, 5, 1, 18, 45, 30, 124])].toString()
            ), 'Date Test9: ISO date with hours, minutes, seconds and milliseconds');

            // 5. Add hours, minutes, seconds, milliseconds and the UTC timezone
            x.test(this.isValidSymbol(
              'date',
              '2025-05-30T07:15:30.123Z',
              [testDate([2025, 4, 30, 7, 15, 30, 123]), testDate([2025, 4, 30, 7, 15, 30, 124])].toString()
            ), 'Date Test10: ISO date with hours, minutes, seconds, milliseconds and the UTC timezone');

            // Date comparison tests
            x.test(this.isValid('created=2025-01-01', 
                    'AND(GTE(foam.core.auth.User.created, ' + testDate([2025, 0, 1, 12]).toString() +  '),LT(foam.core.auth.User.created, ' + testDate([2025, 0, 2, 12]).toString() + '))'), 
                    'Date Test11: Date equality');
            x.test(this.isValid('created = 2025-05-31', 
                    'AND(GTE(foam.core.auth.User.created, ' + testDate([2025, 4, 31, 12]).toString() +  '),LT(foam.core.auth.User.created, ' + testDate([2025, 5, 1, 12]).toString() + '))'), 
                    'Date Test12: Date equality without spaces');
            x.test(this.isValid('lastModified > TODAY-7', 
                    'GT(foam.core.auth.User.lastModified, ' + testToday(-6).toString() + ')'), 
                    'Date Test13: Relative date comparison less than');
            x.test(this.isValid('passwordExpiry <= TODAY+30', 
                    'LTE(foam.core.auth.User.passwordExpiry, ' + testToday(+31).toString() + ')'), 
                    'Date Test14: Relative date comparison grater than or equal');       
             x.test(this.isValid('birthday IN RANGE (2025-03-31, 2025-04-30)', 
                    'AND(GTE(foam.core.auth.User.birthday, ' + testDate([2025, 2, 31, 12]).toString() + '),LT(foam.core.auth.User.birthday, ' +  testDate([2025, 4, 1, 12]).toString() + '))'), 
                    'Date Test15: Date in range');
            x.test(this.isValid('birthday NOT IN RANGE (2025-03-31, 2025-04-30)', // note +12 hours, birthdate is a Date, not a DateTime, hence it is set to noon
                    'AND(GTE(foam.core.auth.User.birthday, ' + testDate([2025, 4, 1, 12]).toString() + '),LT(foam.core.auth.User.birthday, ' +  testDate([2025, 2, 31, 12]).toString() + '))'), 
                    'Date Test16: Date not in range');
            x.test(this.isValid('lastLogin IS EMPTY', 
                    'NOT(HAS(foam.core.auth.User.lastLogin))'), 
                    'Date Test17: Date is empty');
            x.test(this.isValid('lastLogin IS NOT EMPTY', 
                    'HAS(foam.core.auth.User.lastLogin)'), 
                    'Date Test18: Date is not empty');

            // Combined date tests
            x.test(this.isValid('birthday IN RANGE (2025-03-31, 2025-04-30) AND lastLogin IS EMPTY', // note +12 hours, birthdate is a Date, not a DateTime, hence it is set to noon
                    'AND(GTE(foam.core.auth.User.birthday, ' + testDate([2025, 2, 31, 12]).toString() + '),LT(foam.core.auth.User.birthday, ' +  testDate([2025, 4, 1, 12]).toString() + '),NOT(HAS(foam.core.auth.User.lastLogin)))'), 
                    'Date Test19: Date AND query');        
            x.test(this.isValid('birthday NOT IN RANGE (2025-03-31, 2025-04-30) OR lastLogin IS NOT EMPTY', // note +12 hours, birthdate is a Date, not a DateTime, hence it is set to noon
                    'OR(AND(GTE(foam.core.auth.User.birthday, ' + testDate([2025, 4, 1, 12]).toString() + '),LT(foam.core.auth.User.birthday, ' +  testDate([2025, 2, 31, 12]).toString() + ')),HAS(foam.core.auth.User.lastLogin))'), 
                    'Date Test20: Date OR query');


            // Number symbol tests
            x.test(this.isValidSymbol('number', "11", "11"), "Number Test1: The number is 11");
            x.test(this.isValidSymbol('numbers', "1, 2, 3", "1,2,3"), "Number Test2: The numbers 1, 2, 3");
            x.test(this.isValidSymbol('number', "-113", "-113"), "Number Test3: The negative number is -113");
            x.test(this.isValidSymbol('numbers', "1, -2, 33", "1,-2,33"), "Number Test4: The mixed numbers 1, -2, 33");
            x.test(this.isValidSymbol('numberArray', "1)", "1"), "Number Test5: The number array (1)");  
            x.test(this.isValidSymbol('numberArray', "1,2, 3)", "1,2,3"), "Number Test6: The number array (1,2,3)");

            // Number properties tests
            x.test(this.isValid("id = 6", "EQ(foam.core.auth.User.id, 6)"), "Number Test7: The id equal to the value");
            x.test(this.isValid("id!=6", "NEQ(foam.core.auth.User.id, 6)"), "Number Test8: The id not equal to the value");
            x.test(this.isValid("id>6", "GT(foam.core.auth.User.id, 6)"), "Number Test9: The id greater than the value");
            x.test(this.isValid("id>=6", "GTE(foam.core.auth.User.id, 6)"), "Number Test10: The id greater than or equal to the value");
            x.test(this.isValid("id<6", "LT(foam.core.auth.User.id, 6)"), "Number Test11: The id less than the value");
            x.test(this.isValid("id<=6", "LTE(foam.core.auth.User.id, 6)"), "Number Test12: The id less than or equal to the value");
            x.test(this.isValid("id IN (6,7,8)", "IN(foam.core.auth.User.id, [6, 7, 8])"), "Number Test13: The id exactly matches any of the listed values");
            x.test(this.isValid('id NOT IN (6,7,8)', 'NOT(IN(foam.core.auth.User.id, [6, 7, 8]))'), 'Number Test14: The id does not exactly match any of the listed values');

            // Number combined properties tests
            x.test(this.isValid("id=16 AND id<9", "AND(EQ(foam.core.auth.User.id, 16),LT(foam.core.auth.User.id, 9))"), "Number Test15: The id equal to the value and less than another value");
            x.test(this.isValid("id=18 OR id<9", 'OR(EQ(foam.core.auth.User.id, 18),LT(foam.core.auth.User.id, 9))'), "Number Test16: The id equal to the value or less than another value");

            // Enum properties tests
            x.test(this.isValid("lifecycleState= ACTIVE", "EQ(foam.core.auth.User.lifecycleState, ACTIVE)"), "Enum Test1: The status equal to the value");
            x.test(this.isValid("lifecycleState!=ACTIVE", "NEQ(foam.core.auth.User.lifecycleState, ACTIVE)"), "Enum Test2: The status not equal to the value");
            x.test(this.isValid("lifecycleState IN (ACTIVE,REJECTED)", "IN(foam.core.auth.User.lifecycleState, [ACTIVE, REJECTED])"), "Enum Test3: The status exactly matches any of the listed values");
            x.test(this.isValid("lifecycleState NOT IN ( ACTIVE, REJECTED )", "NOT(IN(foam.core.auth.User.lifecycleState, [ACTIVE, REJECTED]))"), "Enum Test4: The status does not exactly match any of the listed values");

            // Boolean properties tests
            x.test(this.isValid(" loginEnabled IS TRUE", "EQ(foam.core.auth.User.loginEnabled, true)"), "Boolean Test1: The enabled is true");
            x.test(this.isValid(" loginEnabled IS FALSE", "EQ(foam.core.auth.User.loginEnabled, false)"), "Boolean Test2: The enabled is false");

            // Parentheses tests
            x.test(this.isValid("( id = 6 )", "EQ(foam.core.auth.User.id, 6)"), "Parentheses Test1: The id equal to the value with parentheses");
            x.test(this.isValid(" (id=17 AND id<9) ", "AND(EQ(foam.core.auth.User.id, 17),LT(foam.core.auth.User.id, 9))"), "Parentheses Test2: The id equal to the value and less than another value with parentheses");
            x.test(this.isValid(" (id=18 OR id<10) ", 'OR(EQ(foam.core.auth.User.id, 18),LT(foam.core.auth.User.id, 10))'), "Parentheses Test3: The id equal to the value or less than another value with parentheses");
  


        },
        function buildPredicate(query) {
            // Assuming foam.parse.SimpleQueryParser.parse returns a predicate object
            let parser = this.SimpleQueryParser.create({of: foam.core.auth.User});
            let predicate = parser.parseString(query);
            return predicate || null;
        }, 
        function isValidSymbol(symbolName, input, expectedOutput, isFloat=false) {
            let parser = this.SimpleQueryParser.create({of: foam.core.auth.User});
            let result = parser.parseString(input, symbolName);
            if (result == null) return false;
            if ( isFloat ) {
                result = parseFloat(result[0]).toFixed(3);
                expectedOutput = parseFloat(expectedOutput).toFixed(3);
            }   
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
