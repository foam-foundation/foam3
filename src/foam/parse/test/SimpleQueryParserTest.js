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
            // insert tests here
            debugger;
            x.test(this.isValid("id=6", "EQ(foam.core.auth.User.id, 6)"), "The id equal to the value");
        },
        function buildPredicate(query) {
            // Assuming foam.parse.SimpleQueryParser.parse returns a predicate object
            let parser = this.SimpleQueryParser.create({of: foam.core.auth.User});
            let predicate = parser.parseString(query);
            return predicate || null;
        },
        function isValid(query, statement) {
            let result = this.buildPredicate(query);
            if (result == null) return false;
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
