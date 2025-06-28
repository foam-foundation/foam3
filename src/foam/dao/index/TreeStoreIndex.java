/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.dao.index;

import foam.dao.store.FileStore;
import foam.dao.store.Stored;
import foam.lang.ClassInfo;
import foam.lang.FObject;
import foam.lang.PropertyInfo;
import foam.lang.X;
import foam.lib.StoragePropertyPredicate;
import foam.lib.formatter.JSONFObjectFormatter;
import java.util.HashSet;
import java.util.Stack;
import java.util.Set;

/**
 * Tree index resposible for storing and retrieving TreeNodes
 */
public class TreeStoreIndex
  extends ProxyIndex {

  protected FileStore      store_;
  protected Boolean        loaded_ = false;
  protected Object         state_  = null;
  public Object getState() {
    return state_;
  }
  // Local variables cleared and reused on each tree update
  protected Stack          left_  = new Stack();
  protected Stack<Stored>  tmp_   = new Stack();
  protected Set<Object>    right_ = new HashSet();

  // formatter used to calculate if store is required.
  protected JSONFObjectFormatter formatter_;

  public TreeStoreIndex(X x, ClassInfo of, String filename, Index delegate)
    throws java.io.IOException {
    super(delegate);
    store_ = new FileStore(x, of, filename);

    // REVIEW: - how to delay this until first find, put?
    // Presently needs to be called so that state can be set in
    // parent AltIndex when MDAO is created.
    maybeInit();
  }

  public FObject find(Object state, Object key) {
    // See notes above regarding initial state
    // maybeInit();
    // if ( state == null || state.equals(TreeNode.getNullNode()) ) {
    //   state = state_;
    // }
    return getDelegate().find(state, key);
  }

  public Object put(Object state, FObject value) {
    // See notes above regarding initial state
    // maybeInit();
    // if ( state == null || state.equals(TreeNode.getNullNode()) ) {
    //   state = state_;
    // }
    Object key = ((PropertyInfo) store_.getOf().getAxiomByName("id")).get(value);
    FObject old = getDelegate().find(state, key);
    TreeNode root = (TreeNode) getDelegate().put(state, value);
    if ( old == null ||
         formatter_.maybeOutputDelta(old, value, null, null)) {
      left_.clear();
      store(pushLeft(left_, root), key);
    }
    state_ = root;
    return root;
  }

  // TODO: remove, removeAll

  protected Stack pushLeft(Stack s, TreeNode node) {
    TreeNode current = node;
    while ( current != null ) {
      s.push(current);
      current = current.getLeft();
    }
    return s;
  }

  // Depth-first traversal
  // At leaf store and push result back on stack.
  // On traveral up, at node where 'right' has already been pushed,
  // store that node with it's children set to their stored references.
  protected void store(Stack left, Object key) {
    tmp_.clear();
    right_.clear();

    while( left.size() > 0 ) {
      Object o = left.pop();
      if ( o instanceof Stored ) {
        tmp_.push((Stored) o);
      } else {
        TreeNode n = (TreeNode) o;
        if ( n.getRight() != null &&
             ! right_.contains(n.getKey()) ) {
          right_.add(n.getKey()); // only push once
          left.push(n);
          left = pushLeft(left, n.getRight());
        } else {
          Stored r = tmp_.size() > 0 ? tmp_.pop() : null;
          Stored l = tmp_.size() > 0 ? tmp_.pop() : null;
          left.push(store(n, l, r, n.getKey().equals(key), left.size() == 0));
        }
      }
    }
  }

  protected Stored store(TreeNode node, Stored left, Stored right, boolean updateValue, boolean root) {
    TreeNodeStored tns = (TreeNodeStored) node.getStored();
    if ( tns == null ) {
      tns = new TreeNodeStored();
    }
    tns.setKey(node.getKey());
    tns.setSize(node.getSize());
    tns.setLevel(node.getLevel());
    tns.setLeft(left);
    tns.setRight(right);

    if ( updateValue ||
         tns.getValue() == null ) {
      tns.setValue(store_.store((FObject) node.getValue()));
    }
    Stored stored = null;
    if ( root ) {
      stored = store_.storeRoot(tns);
    } else {
      stored = store_.store(tns);
    }
    node.setStored((Stored) stored.get());
    return stored;
  }

  // Recreate the Tree
  // TODO: on startup load to level or some time restraint. 
  public TreeNode load(Stored stored) {
    if ( stored == null )
      return null;

    TreeNodeStored tns = (TreeNodeStored) stored.get();
    TreeNode node = new TreeNode(
                                 tns.getKey(),
                                 store_.load(tns.getValue()).get(),
                                 tns.getSize(),
                                 (byte) tns.getLevel(),
                                 load(store_.load(tns.getLeft())),
                                 load(store_.load(tns.getRight()))
                                 );
    node.setStored(tns);
    node.setLoaded(true);  // true when left,right have been attemped.
    // not yet used, could possibly be calculated from tns - ! loaded if tns.left != null && left == null

    return node;
  }

  public synchronized void maybeInit() {
    if ( formatter_ == null ) {
      formatter_ = new JSONFObjectFormatter(store_.getX());
      formatter_.setPropertyPredicate(new StoragePropertyPredicate());
      formatter_.setOutputShortNames(true);
    }

    if ( ! loaded_ ) {
      loaded_ = true;
      state_ = load(store_.getRoot());
    }
  }
}
