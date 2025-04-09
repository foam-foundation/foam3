/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.graph',
  name: 'GraphBuilder',

  implements: [
    'foam.mlang.Expressions'
  ],

  requires: [
    'foam.graph.Graph',
    'foam.graph.GraphNode'
  ],

  properties: [
    {
      name: 'data',
      class: 'Map'
    },
    {
      name: 'roots',
      class: 'Array'
    }
  ],

  methods: [
    function fromCompositeRelationship(rootObject, compositeRelationship, noRootAdd) {
      if ( ! foam.dao.CompositeRelationship.isInstance(compositeRelationship) ) {
        throw new Error("No CompositeRelationship object detected")
      }

      var relationshipPromises = compositeRelationship.getPrimaryForwardNames().map(
        forwardName => this.fromRelationship(rootObject, forwardName, noRootAdd, compositeRelationship )
      );

      return Promise.all(relationshipPromises)
    },
    function fromRelationship(
      rootObject, relationshipKey, noRootAdd, compositeRelationship
    ) {
      // Add graph node (with no relations yet)
      if ( ! this.data[rootObject.id] ) {
        this.data[rootObject.id] = this.GraphNode.create({
          data: rootObject,
          id: rootObject.id
        });
        if ( ! noRootAdd ) this.roots.push(this.data[rootObject.id]);
      }

      var isRoot;
      this.roots.forEach(root => {
        if ( root.id === rootObject.id ) isRoot = true;
      })

      // if root object
      if (
        compositeRelationship
        && compositeRelationship.getSecondaryForwardNames().length > 0
        && isRoot
      ){
        // TODO: make this work with an array
        var secondaryRelationshipKey = compositeRelationship.getSecondaryForwardNames()[0];

        var secondaryRelationshipDAO = rootObject[secondaryRelationshipKey].dao || rootObject[secondaryRelationshipKey];
        secondaryRelationshipDAO.select().then(secondaries => {
          this.data[rootObject.id].secondaryForwardLinks = secondaries.array ? secondaries.array : [secondaries];
        })
      }

      // Iterate over rootObject's children
      var parent = this.data[rootObject.id];
      var relationshipDAO = rootObject[relationshipKey].dao || rootObject[relationshipKey];

      return relationshipDAO
        .select().then(r => Promise.all(r.array.map(o => {
          parent.forwardLinks = [...parent.forwardLinks, { id: o.id } ];

          // Add secondary relationship link but don't create actual nodes for them
          if ( compositeRelationship && compositeRelationship.getSecondaryForwardNames().length > 0 ){
            // TODO: make this work with an array
            var secondaryRelationshipKey = compositeRelationship.getSecondaryForwardNames()[0];

            var secondaryRelationshipDAO = o[secondaryRelationshipKey].dao || o[secondaryRelationshipKey];
            secondaryRelationshipDAO.select().then(secondaries => {
              this.data[o.id].secondaryForwardLinks = secondaries.array ? secondaries.array : [secondaries];
            })
          }

          // Add child and its children (recursively)
          var fromPromise = compositeRelationship
            ? this.fromCompositeRelationship(o, compositeRelationship, true)
            : this.fromRelationship(o, relationshipKey, true);

          return fromPromise.then(() => {
            // Add inverse links before resolving the promise
            this.data[o.id].inverseLinks =
              [...this.data[o.id].inverseLinks, { id: rootObject.id }];
          });
        })));
    },
    async function fromJunction(
      rootObject,
      objectDaoKey,
      junctionDaoKey,
      weightPropertyName,
      noRootAdd
    ) {
      // Add graph node (with no relations yet)
      if ( ! this.data[rootObject.id] ) {
        this.data[rootObject.id] = this.GraphNode.create({
          data: rootObject,
          id: rootObject.id
        });
        if ( ! noRootAdd ) this.roots.push(this.data[rootObject.id]);
      }

      var isRoot;
      this.roots.forEach(root => {
        if ( root.id === rootObject.id ) isRoot = true;
      })

      // Iterate over rootObject's children
      var junctionDAO = this.__subContext__[junctionDaoKey];
      var objectDAO = this.__subContext__[objectDaoKey];

      // assumption is that any junction will consist of AT LEAST:
      // 1. sourceId
      // 2. targetId
      // although this is not enforced anywhere with a common abstract class
      var currentJunctions = await junctionDAO.where(
          this.EQ(junctionDAO.of["SOURCE_ID"], rootObject.id)
        )
        .select();
      
      var targetObjectsPromises = currentJunctions.array.map(junc => {
        

        this.data[junc.sourceId].forwardLinks = [
          ...this.data[junc.sourceId].forwardLinks, 
          { 
            id: junc.targetId,
            weight: junc[weightPropertyName]
          }
        ];

         return objectDAO.find(junc.targetId);
      });

      var targetObjectsResolved = await Promise.all(targetObjectsPromises);

      var childJunctionPromises = targetObjectsResolved.map(res => {
        return this.fromJunction(
          res,
          'capabilityDAO',
          'prerequisiteCapabilityJunctionDAO',
          'priority',
          true
        );
      })

      await Promise.all(childJunctionPromises)

      // the target graphNode is created in the recursive call so after it is done
      // we can just go ahead and update all junctions to have proper inverse links
      currentJunctions.array.forEach(junc => {
        this.data[junc.targetId].inverseLinks = [
          ...this.data[junc.targetId].inverseLinks,
          {
            id: rootObject.id,
            weight: junc[weightPropertyName]
          }
        ];
      })
    },

    function build() {
      let graph = this.Graph.create({ data: this.data });
      graph.roots = this.roots;
      return graph;
    }
  ]
});
