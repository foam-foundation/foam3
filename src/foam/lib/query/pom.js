/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "query",
  licenses: [
    `
    Copyright 2026 The FOAM Authors. All Rights Reserved.
    http://www.apache.org/licenses/LICENSE-2.0
    `
  ],

  files: [
    { name: "TestModel",                                          flags: "js&test|java&test" },
  ],

  javaFiles: [
    { name: "DuringExpressionParser" },
    { name: "LtExpression" },
    { name: "AfterGteParser" },
    { name: "PropertyNameParser" },
    { name: "EqualsParser" },
    { name: "EqExpression" },
    { name: "RelativeDateParser" },
    { name: "YYYYMMDDRangeDateParser" },
    { name: "BeforeLteParser" },
    { name: "CompoundValue" },
    { name: "ContainParser" },
    { name: "PropertyExpressionParser" },
    { name: "YYYYMMDDLiteralDateParser" },
    { name: "AfterGtParser" },
    { name: "ValueParser" },
    { name: "AnyParser" },
    { name: "DateParser" },
    { name: "LiteralDateParser" },
    { name: "OrValue" },
    { name: "GtExpression" },
    { name: "Test",                                               flags: "test" },
    { name: "QueryParser" },
    { name: "AndParser" },
    { name: "BeforeLtParser" },
    { name: "AndValue" },
    { name: "IdentifierStartParser" },
    { name: "NegateValue" },
    { name: "StringParser" },
    { name: "LongParser" },
    { name: "DateRangeParser" },
    { name: "CharParser" },
    { name: "ValueList" },
    { name: "DuringExpression" },
    { name: "OrParser" },
  ]
});
