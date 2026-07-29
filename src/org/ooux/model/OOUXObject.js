/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'org.ooux.model',
    name: 'OOUXObject',
    extends: 'org.konvajs.graph.GraphNode',

    documentation: `An OOUX object: a GraphNode carrying OOUX-specific
      fields. id (GUID factory), label, state and pinned are inherited;
      x/y/width/height/color are re-declared only to override defaults
      for card-sized rendering.`,

    properties: [
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
        { class: 'Double', name: 'x',      value: 100 },
        { class: 'Double', name: 'y',      value: 100 },
        { class: 'Double', name: 'width',  value: 200 },
        { class: 'Double', name: 'height', value: 150 }
    ]
});
