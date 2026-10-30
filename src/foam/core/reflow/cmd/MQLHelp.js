/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'MQLHelp',
  extends: 'foam.core.reflow.cmd.Command',

  properties: [
    [ 'description', 'Help MQL queries' ]
  ],

  methods: [
    function execute() {
      this.out.start('pre').style({'font-family': 'monospace'}).add(`key:value                  key contains "value"
key=value                  key exactly matches "value"
key:value1,value2          key contains "value1" OR "value2"
key:(value1|value2)        "
key1:value key2:value      key1 contains value AND key2 contains "value"
key1:value AND key2:value  "
key1:value and key2:value  "
key1:value OR key2:value   key1 contains value OR key2 contains "value"
key1:value or key2:value   "
key:(-value)               key does not contain "value"
(expr)                     groups expression
-expr                      not expression, ie. -pri:1
NOT expr                   not expression, ie. NOT pri:1
has:key                    key has a value
is:key                     key is a boolean TRUE value
key>value                  key is greater than value
key-after:value            "
key<value                  key is less than value
key-before:value           "
date:YY/MM/DD              date specified
date:today                 date of today
date-after:today-7         date newer than 7 days ago
date:d1..d2                date within range d1 to d2, inclusive
key:me                     key is the current user

Date formats:
YYYY-MM
YYYY-MM-DD
YYYY-MM-DDTHH
YYYY-MM-DDTHH:MM`);
    }
  ]
});
