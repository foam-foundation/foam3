/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.vector',
  name: 'ReadableSourcePredicate',
  extends: 'foam.mlang.predicate.AbstractPredicate',

  documentation: `
    True for a chunk whose source record the user of this predicate's context
    can read, e.g. a chunk of flowDAO's "Getting Started" when that user can
    open "Getting Started". Each record is looked up once, through its own DAO
    in that context, so its own access rules decide. A chunk with no daoKey, or
    a daoKey that is not a DAO there, has no record to read and is false.
    Build it with the caller's context and give it to a search of
    vectorStoreDAO: chunks of other records are then never returned.
  `,

  javaImports: [
    'foam.ai.vector.VectorEmbedding',
    'foam.dao.DAO',
    'foam.util.SafetyUtil',
    'java.util.HashMap',
    'java.util.Map'
  ],

  properties: [
    {
      // "<daoKey>:<sourceId>" to whether the record was found, so the chunks of one doc cost one find
      class: 'Map',
      name: 'readable_',
      javaType: 'Map<String, Boolean>',
      javaFactory: 'return new HashMap<>();',
      transient: true
    }
  ],

  methods: [
    {
      name: 'f',
      javaCode: `
        VectorEmbedding e = (VectorEmbedding) obj;
        return getReadable_().computeIfAbsent(e.getDaoKey() + ":" + e.getSourceId(), k -> {
          Object dao = SafetyUtil.isEmpty(e.getDaoKey()) ? null : getX().get(e.getDaoKey());
          return dao instanceof DAO && ((DAO) dao).inX(getX()).find(e.getSourceId()) != null;
        });
      `
    }
  ]
});
