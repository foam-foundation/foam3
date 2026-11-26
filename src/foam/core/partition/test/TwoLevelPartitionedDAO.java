/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.partition.test;

import foam.core.partition.PartitionedDAO;
import foam.dao.DAO;
import foam.lang.ClassInfo;
import foam.lang.X;
import foam.mlang.Expr;

/**
 * Test fixture for a two-level partitioned DAO, the shape an application uses
 * when it splits a large journal first by one property and then by another.
 * Level 1 partitions by {@code outerProperty}; each partition's delegate is a
 * nested PartitionedDAO (depth + 1) partitioning by {@code innerProperty},
 * whose own delegates are the leaf journals. Exercises that SingleToPartitionMigrator
 * routes through every level via put_ rather than computing the partition itself.
 */
public class TwoLevelPartitionedDAO
  extends PartitionedDAO
{
  protected Expr innerProperty_;

  public TwoLevelPartitionedDAO(X x, ClassInfo of, String dirName, Expr outerProperty, Expr innerProperty) {
    super(x, of, dirName, outerProperty);
    innerProperty_ = innerProperty;
  }

  public DAO createDAO(String part) {
    String journalName = partitionDirFor(part);

    PartitionedDAO inner = new PartitionedDAO(getX(), getOf(), journalName, innerProperty_);
    inner.setDepth(getDepth() + 1);

    return inner;
  }
}
