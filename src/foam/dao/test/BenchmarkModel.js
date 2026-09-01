/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * A 50-property model covering every FOAM property type, with generic
 * names and synthetic values only. Used by the journal replay benchmarks
 * and the Jackson correctness test.
 */
foam.CLASS({
  package: 'foam.dao.test',
  name: 'BenchmarkModel',

  ids: ['seq'],

  properties: [
    // ---- Simple scalars ----
    { class: 'Long',     name: 'seq' },
    { class: 'String',   name: 'groupId',       shortName: 'p1' },
    { class: 'String',   name: 'network',        shortName: 'p2' },
    { class: 'String',   name: 'convRate',       shortName: 'p3' },
    { class: 'String',   name: 'currCode',       shortName: 'p4' },
    { class: 'String',   name: 'altCurrCode',    shortName: 'p5' },
    { class: 'String',   name: 'authInd',        shortName: 'p6' },
    { class: 'String',   name: 'extraData',      shortName: 'p7' },
    { class: 'String',   name: 'approvalNum',    shortName: 'p8' },
    { class: 'String',   name: 'traceId',        shortName: 'p9' },
    { class: 'String',   name: 'respCode',       shortName: 'p10' },
    { class: 'String',   name: 'baseCurr',       shortName: 'p11' },
    { class: 'String',   name: 'flag1',          shortName: 'p12' },
    { class: 'String',   name: 'flag2',          shortName: 'p13' },
    { class: 'String',   name: 'ref1',           shortName: 'p14' },
    { class: 'String',   name: 'code1',          shortName: 'p15' },
    { class: 'String',   name: 'token' },
    { class: 'String',   name: 'amountStr' },
    { class: 'String',   name: 'statusCode' },
    { class: 'String',   name: 'accountRef' },
    { class: 'String',   name: 'entityRef' },
    { class: 'String',   name: 'acquirerRef' },
    { class: 'String',   name: 'merchantId' },
    { class: 'String',   name: 'categoryCode' },
    { class: 'String',   name: 'merchantName' },
    { class: 'String',   name: 'city' },
    { class: 'String',   name: 'country' },
    { class: 'String',   name: 'terminalId' },
    { class: 'String',   name: 'filePath' },
    { class: 'DateTime', name: 'dateTime1',      shortName: 't1' },
    { class: 'Date',     name: 'date1',          shortName: 't2' },
    { class: 'Date',     name: 'date2',          shortName: 't3' },
    { class: 'DateTime', name: 'createdAt' },
    { class: 'Double',   name: 'value1',         shortName: 'n1' },
    { class: 'Double',   name: 'value2',         shortName: 'n2' },
    { class: 'Double',   name: 'value3',         shortName: 'n3' },
    { class: 'Double',   name: 'amount' },
    { class: 'Double',   name: 'fee' },
    { class: 'Double',   name: 'baseValue' },
    { class: 'Double',   name: 'reconValue' },
    { class: 'Double',   name: 'holdValue' },
    { class: 'Long',     name: 'counter',        shortName: 'n4' },
    { class: 'Long',     name: 'refSeq' },
    { class: 'Long',     name: 'sourceId' },
    { class: 'Boolean',  name: 'active' },
    { class: 'Int',      name: 'priority' },

    // ---- Complex types (Enum, Reference, nested FObject, Array) ----
    {
      class: 'Enum',
      of: 'foam.core.auth.LifecycleState',
      name: 'lifecycleState'
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'createdBy'
    },
    {
      class: 'StringArray',
      name: 'tags'
    }
  ]
});
