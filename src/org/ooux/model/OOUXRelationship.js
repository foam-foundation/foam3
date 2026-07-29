/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'org.ooux.model',
    name: 'OOUXRelationship',
    extends: 'org.konvajs.graph.GraphEdge',

    documentation: `A directed relationship between two OOUXObjects. All
      structure (id, label, sourceId, targetId, style, state, points) is
      inherited from GraphEdge. This class exists as the OOUX domain type;
      later sub-projects add OOUX-specific fields (e.g. a link type).`
});
