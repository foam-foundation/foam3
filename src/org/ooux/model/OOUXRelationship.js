/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'org.ooux.model',
    name: 'OOUXRelationship',

    properties: [
        {
            class: 'String',
            name: 'id',
            factory: function() { return foam.uuid.randomGUID(); }
        },
        {
            class: 'String',
            name: 'label',
            value: 'related to'
        },
        { class: 'String', name: 'sourceId' },
        { class: 'String', name: 'targetId' }
    ]
});
