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
            name: 'properties',
            view: {
                // The default row view (FObjectView) is an async class
                // chooser; its render races the sidebar rebuild on
                // selection change and crashes. Rows are always
                // OOUXProperty, so render them directly.
                class: 'foam.u2.view.FObjectArrayView',
                valueView: { class: 'foam.u2.detail.VerticalDetailView' }
            }
        },
        {
            class: 'Color',
            name: 'color',
            value: '#3498db' // Default Blue
        },
        {
            class: 'String',
            name: 'label',
            value: 'Node',
            hidden: true // Cards render 'name'; label is unused here.
        },
        // Position and size are canvas-managed (drag, Transformer, Align);
        // hidden so the sidebar editor doesn't fight the canvas.
        { class: 'Double', name: 'x',      value: 100, hidden: true },
        { class: 'Double', name: 'y',      value: 100, hidden: true },
        { class: 'Double', name: 'width',  value: 200, hidden: true },
        { class: 'Double', name: 'height', value: 150, hidden: true }
    ]
});
