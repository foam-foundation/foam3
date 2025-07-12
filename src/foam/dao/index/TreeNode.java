/**
 * @license
 * copyright 2017 The FOAM Authors. All Rights Reserved.
 *     http://www.apache.org/licenses/LICENSE-2.0
 */
package foam.dao.index;

import foam.lang.FObject;
import foam.lang.Indexer;
import foam.dao.AbstractDAO;
import foam.dao.Sink;
import foam.dao.store.Stored;
import foam.mlang.order.Comparator;
import foam.mlang.predicate.Predicate;
import foam.mlang.predicate.True;
import foam.mlang.sink.GroupBy;
import static foam.dao.AbstractDAO.decorateSink;


/** AATree implementation. See: https://en.wikipedia.org/wiki/AA_tree **/
public class TreeNode {
  protected Object   key;
  protected Object getKey() { return key; }
  protected Object   value;
  protected long     size;
  protected long getSize() { return size; }
  protected byte     level;
  protected byte getLevel() { return level; }
  protected TreeNode left;
  protected TreeNode right;

  protected TreeNodeStored stored;
  protected TreeNodeStored getStored() { return stored; }
  protected void setStored(TreeNodeStored stored) { this.stored = stored; }

  protected final static TreeNode NULL_NODE = new TreeNode(null, null, 0, (byte) 0, null, null);

  public TreeNode(Object key, Object value) {
    this.key   = key;
    this.value = value;
  }

  public TreeNode(Object key, Object value, long size, byte level, TreeNode left, TreeNode right) {
    this.key   = key;
    this.value = value;
    this.size  = size;
    this.level = level;
    this.left  = left;
    this.right = right;
  }

  public TreeNode(Object key, Object value, long size, byte level, TreeNode left, TreeNode right, TreeNodeStored stored) {
    this.key   = key;
    this.value = value;
    this.size  = size;
    this.level = level;
    this.left  = left;
    this.right = right;
    this.stored = stored;
  }

  public TreeNode cloneNode() {
    return new TreeNode(
      key,
      value,
      size,
      level,
      left,
      right,
      stored);
  }

  TreeNode maybeClone(TreeNode s) {
    return s == null ? null : s.cloneNode();
  }

  public static TreeNode getNullNode() {
    return NULL_NODE;
  }

  // A Tree is Singular if contains only one node.
  // Singular Trees can be better planned/searched using sub-indices.
  public boolean isSingular() {
    return getLeft() == null && getRight() == null;
  }

  public Object bulkLoad(Index tail, Indexer indexer, int start, int end, FObject[] a) {
    if ( end < start ) return null;

    int m = start + (int) Math.floor((end-start+1)/2);
    TreeNode tree = this.putKeyValue(this, indexer, indexer.f(a[m]), a[m], tail);
    tree.left  = (TreeNode) this.bulkLoad(tail, indexer, start, m-1, a);
    tree.right = (TreeNode) this.bulkLoad(tail, indexer, m+1, end, a);
    tree.size  = this.size(tree.getLeft()) + this.size(tree.getRight());

    return tree;
  }

  public TreeNode putKeyValue(TreeNode state, Indexer indexer, Object key, FObject value, Index tail) {
    if ( state == null || state.equals(TreeNode.getNullNode()) ) {
      return new TreeNode(key, tail.put(null, value), 1, (byte) 1, null, null);
    }
    state = maybeClone(state);
    int r = indexer.comparePropertyToValue(key, state.key);

    if ( r == 0 ) {
      state.size -= tail.size(state.value);
      state.value = tail.put(state.value, value);
      state.size += tail.size(state.value);
    } else {
      if ( r < 0 ) {
        if ( state.getLeft() != null ) {
          state.size -= state.left.size;
        }
        state.left = this.putKeyValue(state.getLeft(), indexer, key, value, tail);
        state.size += state.left.size;
      } else {
        if ( state.getRight() != null ) {
          state.size -= state.right.size;
        }
        state.right = this.putKeyValue(state.getRight(), indexer, key, value, tail);
        state.size += state.right.size;
      }
    }

    return split(skew(state, tail), tail);
  }

  public TreeNode skew(TreeNode node, Index tail) {
    /** 'node' should be a new (cloned) TreeNode, not a reused one. **/
    if ( node != null && node.getLeft() != null && node.left.level == node.level ) {
      // Swap the pointers of horizontal left links.
      TreeNode l = maybeClone(node.getLeft());

      node.left = l.getRight();
      l.right   = node;
      updateSize(node, tail);
      updateSize(l, tail);

      return l;
    }
    return node;
  }

  public TreeNode split(TreeNode node, Index tail) {
    if ( node != null && node.getRight() != null && node.right.getRight() != null &&
        node.level == node.right.right.level ) {
      // Swap the pointers of horizontal left links.
      TreeNode r = maybeClone(node.getRight());

      node.right = r.getLeft();
      r.left = node;
      r.level++;
      node   = updateSize(node, tail);
      r      = updateSize(r, tail);

      return r;
    }

    return node;
  }

  public TreeNode removeKeyValue(TreeNode state, Indexer indexer, Object key,
    FObject value, Index tail) {
    if ( state == null ) return state;

    state = maybeClone(state);
    long compareValue = indexer.comparePropertyToValue(key, state.key);

    if ( compareValue == 0 ) {
      state.size -= tail.size(state.value);
      state.value = tail.remove(state.value, value);

      if ( state.value != null ) {
        state.size += tail.size(state.value);
        return state;
      }

      if ( state.getLeft() == null && state.getRight() == null ) return null;

      boolean  isLeft = ( state.getLeft() != null );
      TreeNode subs   = isLeft ? predecessor(state) : successor(state);
      state.key   = subs.key;
      state.value = subs.value;

      if ( isLeft ) {
        state.left = removeNode(state.getLeft(), subs.key, indexer);
      } else {
        state.right = removeNode(state.getRight(), subs.key, indexer);
      }
    } else {
      if ( compareValue < 0 ) {
        state.size -= size(state.getLeft());
        state.left  = removeKeyValue(state.getLeft(), indexer, key, value, tail);
        state.size += size(state.getLeft());
      } else {
        state.size -= size(state.getRight());
        state.right = removeKeyValue(state.getRight(), indexer, key, value, tail);
        state.size += size(state.getRight());
      }
    }
    // Rebalance the tree. Decrease the level of all nodes in this level if
    // necessary, and then skew and split all nodes in the new level.
    state = skew(decreaseLevel(state), tail);
    if ( state.getRight() != null ) {
      state.right = skew(maybeClone(state.getRight()), tail);
      if ( state.right.getRight() != null ) {
        state.right.right = skew(maybeClone(state.right.getRight()), tail);
      }
    }
    state = split(state, tail);
    state.right = split(maybeClone(state.getRight()), tail);

    return state;
  }

  private TreeNode removeNode(TreeNode state, Object key, Indexer indexer) {
    if ( state == null ) return state;

    state  = maybeClone(state);
    long compareValue = indexer.comparePropertyToValue(state.key, key);

    if ( compareValue == 0 ) return state.getLeft() != null ? state.left : state.getRight();

    if ( compareValue > 0 ) {
      state.size -= size(state.getLeft());
      state.left  = removeNode(state.getLeft(), key, indexer);
      state.size += size(state.getLeft());
    } else {
      state.size -= size(state.getRight());
      state.right = removeNode(state.getRight(), key, indexer);
      state.size += size(state.getRight());
    }

    return state;
  }

  private TreeNode predecessor(TreeNode node) {
    if ( node.getLeft() == null ) return node;

    node = node.getLeft();
    while ( node.getRight() != null ) {
      node = node.getRight();
    }
    return node;
  }

  private TreeNode successor(TreeNode node) {
    if ( node.getRight() == null ) return node;
    node = node.getRight();
    while ( node.getLeft() != null ) {
      node = node.getLeft();
    }
    return node;
  }

  private TreeNode decreaseLevel(TreeNode node) {
    /** 'node' should be a new (cloned) TreeNode, not a reused one. **/
    byte expectedLevel = (byte) (1 + Math.min(
      node.getLeft()  != null ? node.left.level  : 0 ,
      node.getRight() != null ? node.right.level : 0));

    if ( expectedLevel < node.level ) {
      node.level = expectedLevel;
      if ( node.getRight() != null && expectedLevel < node.right.level ) {
        node.right = maybeClone(node.getRight());
        node.right.level = expectedLevel;
      }
    }

    return node;
  }

  private TreeNode updateSize(TreeNode node, Index tail) {
    node.size = size(node.getLeft()) + size(node.getRight()) + tail.size(node.value);
    return node;
  }

  private long size(TreeNode node) {
    return node == null ? 0 : node.size;
  }

  /** extracts the value with the given key from the index */
  public TreeNode get(TreeNode s, Object key, Indexer indexer) {
    if ( s == null ) return s;

    int r = indexer.comparePropertyToValue(key, s.key);
    if ( r == 0 ) {
      long size = s.value instanceof TreeNode ? ( (TreeNode) s.value ).size : 1;
      return new TreeNode(s.key, s.value, size, (byte) 0, null, null);
    }
    return r > 0 ? get(s.getRight(), key, indexer) : get(s.getLeft(), key, indexer);
  }

  public void setLeft(TreeNode node) {
    left = node;
  }

  protected TreeNode getLeft() {
    // if ( left == null && getStored() != null && getStored().getLeft() != null && ! getStored().getLeftLoaded() )
    if ( left == null && getStored() != null && getStored().getLeft() != null )
      left = getStored().loadLeft();

    return left;
  }

  public void setRight(TreeNode node) {
    right = node;
  }

  protected TreeNode getRight() {
    // if ( right == null && getStored() != null && getStored().getRight() != null && ! getStored().getRightLoaded() )
    if ( right == null && getStored() != null && getStored().getRight() != null )
      right = getStored().loadRight();

    return right;
  }

  protected Object getValue() {
    return value;
  }

//  public TreeNode neq(TreeNode s, Object key, Indexer indexer) {
//    return removeNode(s, key, indexer);
//  }

  public TreeNode gt(TreeNode s, Object key, Indexer indexer) {
    if ( s == null ) return s;

    int r = indexer.comparePropertyToValue(key, s.key);
    if ( r < 0 ) {
      TreeNode l = gt(s.getLeft(), key, indexer);
      long newSize = size(s) - size(s.getLeft()) + size(l);
      return new TreeNode(s.key, s.value, newSize, s.level, l, s.getRight());
    }

    if ( r > 0 ) return gt(s.getRight(), key, indexer);

    return s.getRight();
  }

  public TreeNode gte(TreeNode s, Object key, Indexer indexer) {
    if ( s == null ) return s;

    int r = indexer.comparePropertyToValue(key, s.key);
    if ( r < 0 ) {
      TreeNode l = gte(s.getLeft(), key, indexer);
      long newSize = size(s) - size(s.getLeft()) + size(l);
      return new TreeNode(s.key, s.value, newSize, s.level, l, s.getRight());
    }

    if ( r > 0 ) return gte(s.getRight(), key, indexer);

    return new TreeNode(s.key, s.value, size(s) - size(s.getLeft()),
      s.level, null, s.getRight());
  }

  public TreeNode lt(TreeNode s, Object key, Indexer indexer) {
    if ( s == null ) return s;

    int r = indexer.comparePropertyToValue(key, s.key);
    if ( r > 0 ) {
      TreeNode right = lt(s.getRight(), key, indexer);
      long newSize = size(s) - size(s.getRight()) + size(right);
      return new TreeNode(s.key, s.value, newSize, s.level, s.getLeft(), right);
    }

    if ( r < 0 ) return lt(s.getLeft(), key, indexer);

    return s.getLeft();
  }

  public TreeNode lte(TreeNode s, Object key, Indexer indexer) {
    if ( s == null ) return s;

    int r = indexer.comparePropertyToValue(key, s.key);
    if ( r > 0 ) {
      TreeNode right = lte(s.getRight(), key, indexer);
      long newSize = size(s) - size(s.getRight()) + size(right);
      return new TreeNode(s.key, s.value, newSize,
        s.level, s.getLeft(), right);
    }

    if ( r < 0 ) return lte(s.getLeft(), key, indexer);

    return new TreeNode(s.key, s.value, size(s) - size(s.getRight()), s.level, s.getLeft(), null);
  }

  /**
   * In-order traversal to reach every node of Tree, and put data into sink
   */
  protected void select_(TreeNode currentNode, Sink sink, Index tail) {
    if ( currentNode == null ) return;

    TreeNode left = currentNode.getLeft();
    if ( left != null ) select_(left, sink, tail);

    Object value = currentNode.getValue();
    if ( value != null ) {
      // Sometimes the value will be a sub-tree.
      // If value is a sub-tree, the tail will be treeIndex, use tail to re-select the plan to reach the data. If the index is valueIndex the value will be an object.
      tail.planSelect(value, sink, 0, AbstractDAO.MAX_SAFE_INTEGER, null, null).select(value, sink, 0, AbstractDAO.MAX_SAFE_INTEGER, null, null);
    }

    TreeNode right = currentNode.getRight();
    if ( right != null ) select_(right, sink, tail);
  }

  /**
   * This function only used for GroupByPlan. To out each data if the tree to groupBy sink.
   */
  protected void groupBy(TreeNode currentNode, Sink sink, Index tail) {
    if ( currentNode == null ) return;

    TreeNode left = currentNode.getLeft();
    long leftSize = 0;
    if ( left != null ) groupBy(left, sink, tail);
    Object value = currentNode.getValue();
    if ( value != null ) {

      // GroupBy sink implement by HashMap, the key is the indexererty of groupBy and the value will be another sink(ex:MAX, MIN, SUM, MAP, GROUPBY, ARRAYSINK ...)
      // Different sink will do different operation of Object.
      // If we have index of the parameter which we want to grouby this parameter. Each value will be a object or a sub-tree and in they should be in the same group.
      // Each group need a new sink, so deepclone the origin sink of groupBy's arg2.
      Sink temp = (Sink) ( (FObject) ( (GroupBy) sink ).getArg2() ).deepClone();
      tail.planSelect(value, temp, 0, AbstractDAO.MAX_SAFE_INTEGER, null, null)
        .select(value, temp, 0, AbstractDAO.MAX_SAFE_INTEGER, null, null);

      // After operate every node in each group, just put the sink into groupBy's HashMap.
      ( ( (GroupBy) sink ).getGroups() ).put(currentNode.key, temp);
    }
    TreeNode right = currentNode.getRight();
    if ( right != null ) groupBy(right, sink, tail);
  }

  /**
   * In-order traversal with efficient skip and limit.
   * Each node contains a 'size' will show the amount of node under itself. When first reach the one node, check the the number of nodes under it leftchild.
   * If amount <= skip number just skip it. If amount > skip number, go into this branch and check the size again.
   * When skip number is 0, it will then perform a regular in-order traversal.
   * When the limit node is 0, stop the whole traversal.
   * Skip and limit are provided in a long[] so that they can be updated.
   *
   * @return a long[] which contains update skip and limit number.
   */
  protected void skipLimitTreeNode(TreeNode currentNode, Sink sink, long[] skipLimit, Index tail, boolean reverse) {
    if ( skipLimit[1] <= 0 || currentNode == null ) return;

    long size = currentNode.size;
    if ( size <= skipLimit[0] ) {
      skipLimit[0] -= size;
      return;
    }

    TreeNode left  = reverse ? currentNode.getRight() : currentNode.getLeft();
    TreeNode right = reverse ? currentNode.getLeft()  : currentNode.getRight();

    if ( left != null ) {
      skipLimitTreeNode(left, sink, skipLimit, tail, reverse);
    }

    Object value = currentNode.getValue();
    tail.planSelect(value, sink, skipLimit[0], skipLimit[1], null, null).select(value, sink, skipLimit[0], skipLimit[1], null, null);
    long tailSize = tail.size(value);
    skipLimit[0] -= tailSize;
    if ( skipLimit[0] < 0 ) {
      skipLimit[1] += skipLimit[0];
      skipLimit[0] = 0;
    }

    if ( right != null ) {
      skipLimitTreeNode(right, sink, skipLimit, tail, reverse);
    }
  }

  /**
   * Select which traversal method will be efficient to get data
   */
  public void select(TreeNode currentNode, Sink sink, long skip, long limit, Comparator order, Predicate predicate, Index tail, boolean reverse) {
    if ( skip >= currentNode.size || limit <= 0 ) return;

    if ( hasPredicate(predicate) || order != null ) {
      sink = decorateSink(null, sink, skip, limit, order, predicate);
      select_(currentNode, sink, tail);
      if ( order != null ) sink.eof();
    } else {
      skipLimitTreeNode(currentNode, sink, new long[] {skip, limit}, tail, reverse);
    }
  }

  public boolean hasPredicate(Predicate predicate) {
    return predicate != null && predicate.partialEval() != null && ! ( predicate instanceof True );
  }

  public String toString() {
    return "TreeNode(" + key + ", " + value + ", " + size + ")";
  }
}
