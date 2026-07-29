/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'org.ooux.model',
    name: 'OOUXProperty',

    properties: [
        {
            class: 'String',
            name: 'name'
        },
        {
            class: 'String',
            name: 'type',
            value: 'String' // could be enum later
        },
        {
            class: 'Boolean',
            name: 'required'
        }
    ]
});
