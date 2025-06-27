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
import foam.lang.X;
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
  protected TreeNodeStored tns_   = new TreeNodeStored();

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
    maybeInit();
    if ( state == null || state.equals(TreeNode.getNullNode()) ) {
      state = state_;
    }
    return getDelegate().find(state, key);
  }

  public Object put(Object state, FObject value) {
    maybeInit();
    if ( state == null || state.equals(TreeNode.getNullNode()) ) {
      state = state_;
    }
    TreeNode node = (TreeNode) getDelegate().put(state, value);

    left_.clear();
    left_ = pushLeft(left_, node);
    if ( left_.size() > 0 ) {
      store(left_);
    } else {
      store(node, null, null, true);
    }
    state_ = node;
    return node;
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
  protected Stored store(Stack left) {
    tmp_.clear();
    right_.clear();

    TreeNode n = null;
    while( left.size() > 0 ) {
      Object o = left.pop();
      if ( o instanceof Stored ) {
        tmp_.push((Stored) o);
      } else {
        n = (TreeNode) o;
        if ( n.getRight() != null &&
             ! right_.contains(n.getKey()) ) {
          right_.add(n.getKey()); // only push once
          left.push(n);
          left = pushLeft(left, n.getRight());
        } else {
          Stored r = tmp_.size() > 0 ? tmp_.pop() : null;
          Stored l = tmp_.size() > 0 ? tmp_.pop() : null;
          left.push(store(n, l, r, left.size() == 0));
        }
      }
    }
    Stored r = tmp_.size() > 0 ? tmp_.pop() : null;
    Stored l = tmp_.size() > 0 ? tmp_.pop() : null;
    return store( left.size() > 0 ? (TreeNode) left.pop() : n, l, r, left.size() == 0);
  }

  protected Stored store(TreeNode node, Stored left, Stored right, boolean root) {
    TreeNodeStored tns = tns_;
    tns.setKey(node.getKey());
    tns.setSize(node.getSize());
    tns.setLevel(node.getLevel());
    tns.setValue(store_.store((FObject) node.getValue()));
    tns.setLeft(left);
    tns.setRight(right);
    if ( root ) {
      return store_.storeRoot(tns);
    } else {
      return store_.store(tns);
    }
  }

  // Recreate the Tree
  public TreeNode load(Stored stored) {
    if ( stored == null ) return null;
    TreeNodeStored tns = (TreeNodeStored) stored.get();
    TreeNode node = new TreeNode(
                                 tns.getKey(),
                                 store_.load(tns.getValue()).get(),
                                 tns.getSize(),
                                 (byte) tns.getLevel(),
                                 load(store_.load(tns.getLeft())),
                                 load(store_.load(tns.getRight()))
                                 );
    return node;
  }

  public synchronized void maybeInit() {
    if ( ! loaded_ ) {
      loaded_ = true;
      state_ = load(store_.getRoot());
    }
  }
}
