/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'PartitionPredicateTest',
  extends: 'foam.core.test.Test',

  documentation: `PartitionedDAO.extractPredicateValue(predicate, prop) reads the
    value or values an EQ or IN on the partition property gives, looking inside an
    AND, so a DAO that is not a PartitionedDAO can route by the same terms.`,

  javaImports: [
    'foam.core.partition.PartitionedDAO',
    'foam.mlang.Expr',
    'java.util.Arrays',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.IN',
    'static foam.mlang.MLang.NOT',
    'static foam.mlang.MLang.OR'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        Expr bucket = PartitionStrRecord.BUCKET;

        Object eq = PartitionedDAO.extractPredicateValue(EQ(bucket, 7), bucket);
        test(Integer.valueOf(7).equals(eq), "an EQ on the property gives its value, got " + eq);

        Object in = PartitionedDAO.extractPredicateValue(
          IN(bucket, new Object[] { 5, 9 }), bucket);
        test(in instanceof Object[] && ((Object[]) in).length == 2,
          "an IN over an array gives the array");

        Object inList = PartitionedDAO.extractPredicateValue(
          IN(bucket, Arrays.asList(5, 9)), bucket);
        test(inList instanceof Object[] && ((Object[]) inList).length == 2,
          "an IN over a List gives its values as an array");

        Object inAnd = PartitionedDAO.extractPredicateValue(
          AND(EQ(PartitionStrRecord.DATA, "x"), EQ(bucket, 3)), bucket);
        test(Integer.valueOf(3).equals(inAnd),
          "the term is found inside an AND, beside other conditions");

        test(PartitionedDAO.extractPredicateValue(EQ(PartitionStrRecord.DATA, "x"), bucket) == null,
          "an EQ on another property gives nothing");
        test(PartitionedDAO.extractPredicateValue(OR(EQ(bucket, 1), EQ(bucket, 2)), bucket) == null,
          "an OR names no single route, so it gives nothing");
        test(PartitionedDAO.extractPredicateValue(NOT(EQ(bucket, 1)), bucket) == null,
          "a NOT gives nothing");
        test(PartitionedDAO.extractPredicateValue(null, bucket) == null,
          "no predicate gives nothing");
      `
    }
  ]
});
