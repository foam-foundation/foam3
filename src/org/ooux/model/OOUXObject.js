/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'org.ooux.model',
    name: 'OOUXObject',

    properties: [
        {
            class: 'String',
            name: 'id',
            documentation: `Must be unique and non-empty: the board's DAO keys
              on it, and an empty default would make every object overwrite the
              last one on put().`,
            factory: function () { return foam.uuid.randomGUID(); }
        },
        {
            class: 'String',
            name: 'name',
            value: 'New Object'
        },
        {
            class: 'String',
            name: 'description'
        },
        {
            class: 'FObjectArray',
            of: 'org.ooux.model.OOUXProperty',
            name: 'properties'
        },
        {
            class: 'Color',
            name: 'color',
            value: '#3498db' // Default Blue
        },
        {
            class: 'Double',
            name: 'x',
            value: 100
        },
        {
            class: 'Double',
            name: 'y',
            value: 100
        },
        {
            class: 'Double',
            name: 'width',
            value: 200
        },
        {
            class: 'Double',
            name: 'height',
            value: 150
        }
    ]
});
