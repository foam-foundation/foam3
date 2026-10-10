/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.partition.test;

import foam.core.partition.DatePartitionedDAO;
import foam.core.partition.DatePartitioningScheme;
import foam.core.partition.PartitionedDAO;
import foam.dao.DAO;
import foam.lang.ClassInfo;
import foam.lang.X;
import foam.mlang.Expr;

/**
 * Test fixture for a two-level partitioned DAO: level 1 partitions
 * by {@code regionProperty}, each region's delegate is a DatePartitionedDAO
 * (depth + 1) by month over {@code dateProperty}, whose delegates are the leaf
 * journals.
 */
public class RegionDatePartitionedDAO
  extends PartitionedDAO
{
  protected Expr dateProperty_;

  public RegionDatePartitionedDAO(X x, ClassInfo of, String dirName, Expr regionProperty, Expr dateProperty) {
    super(x, of, dirName, regionProperty);
    dateProperty_ = dateProperty;
  }

  public DAO createDAO(String part) {
    PartitionedDAO inner = new DatePartitionedDAO(
      getX(), getOf(), getDirName() + part + "/", dateProperty_, DatePartitioningScheme.YYYYMM);
    inner.setDepth(getDepth() + 1);
    addIndices(inner);
    return inner;
  }
}
