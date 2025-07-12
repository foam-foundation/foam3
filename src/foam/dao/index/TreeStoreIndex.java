/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.dao.index;

import foam.core.logger.Logger;
import foam.core.logger.Loggers;
import foam.dao.store.FileStore;
import foam.dao.store.Stored;
import foam.lang.ClassInfo;
import foam.lang.FObject;
import foam.lang.Indexer;
import foam.lang.PropertyInfo;
import foam.lang.X;
import foam.lib.StoragePropertyPredicate;
import foam.lib.formatter.JSONFObjectFormatter;
import foam.util.SafetyUtil;
import java.util.Deque;
import java.util.HashSet;
import java.util.Iterator;
import java.util.ArrayDeque;
import java.util.Set;

/**
 * Tree index resposible for storing and retrieving TreeNodes
 */
public class TreeStoreIndex
  extends ProxyIndex {

  protected FileStore      store_;
  protected Boolean        loaded_  = false;
  protected Object         state_   = null;
  public Object getState() {
    return state_;
  }

  // formatter used to calculate if store is required.
  protected JSONFObjectFormatter formatter_;

  public TreeStoreIndex(X x, ClassInfo of, String filename, Index delegate)
    throws java.io.IOException {
    super(delegate);
    store_ = new FileStore(x, of, filename);

    init();
  }

  public Object put(Object state, FObject value) {
    Object key = ((PropertyInfo) store_.getOf().getAxiomByName("id")).get(value);
    FObject old = getDelegate().find(state, key);
    TreeNode root = (TreeNode) getDelegate().put(state, value);
    if ( old == null ||
         formatter_.maybeOutputDelta(old, value, null, null)) {
      store(root, key);
    }
    state_ = root;
    return root;
  }

  // TODO: remove, removeAll

  protected Deque pushLeft(Deque s, TreeNode node) {
    TreeNode current = node;
    while ( current != null ) {
      s.addFirst(current);
      current = current.getLeft();
    }
    return s;
  }

  // Post-order traversal
  // On 'store' push result back on stack.
  // On traveral up, at node where 'right' has already been pushed,
  // store that node with it's children set to their stored references.
  protected void store(TreeNode node, Object key) {
    Logger logger = Loggers.logger(store_.getX(), this);
    // logger.info("store,root", node.getKey(), key, node.getLeft()!=null?node.getLeft().getKey():"", node.getRight()!=null?node.getRight().getKey():"");

    Deque<Stored> stored = new ArrayDeque();
    Set<Object>   right  = new HashSet();
    Deque stack = pushLeft(new ArrayDeque(), node);

    while( stack.size() > 0 ) {
      // printStack("stack", stack);
      Object o = stack.pop();
      if ( o instanceof Stored ) {
        stored.addFirst((Stored)o);
      } else {
        node = (TreeNode) o;
        if ( node.getRight() != null &&
             ! right.contains(node.getKey()) ) {
          right.add(node.getKey()); // only push once
          stack.addFirst(node);
          while ( stored.size() > 0 ) {
            stack.addFirst(stored.pop());
          }
          stack = pushLeft(stack, node.getRight());
        } else {
          Stored l = stored.size() > 0 ? stored.removeFirst() : null;
          Object lk = (l != null ? ((StoredTreeNode)l.get()).getKey() : null);
          Stored r = stored.size() > 0 ? stored.removeFirst() : null;
          Object rk = (r != null ? ((StoredTreeNode)r.get()).getKey() : null);
          if ( SafetyUtil.compare(lk, rk) > 0 ) {
            Stored t = l; l = r; r = t;
          }
          stack.addFirst(store(node, l, r, node.getKey().equals(key), stack.size() == 0));
        }
      }
    }
  }

  protected Stored store(TreeNode node, Stored left, Stored right, boolean updateValue, boolean root) {
    // Loggers.logger(store_.getX(), this).info("storing", node.getKey(), left!=null?((StoredTreeNode)left.get()).getKey():"", right!=null?((StoredTreeNode) right.get()).getKey():"", updateValue, root);

    StoredTreeNode stn = (StoredTreeNode) node.getStored();
    if ( stn == null ) {
      stn = new StoredTreeNode();
    }
    stn.setKey(node.getKey());
    stn.setSize(node.getSize());
    stn.setLevel(node.getLevel());
    stn.setLeft(left);
    stn.setRight(right);

    if ( updateValue ||
         stn.getValue() == null ) {
      stn.setValue(store_.store((FObject) node.getValue()));
    }
    Stored stored = null;
    if ( root ) {
      stored = store_.storeRoot(stn);
    } else {
      stored = store_.store(stn);
    }
    node.setStored((StoredTreeNode) stored.get());
    return stored;
  }

  // Recreate the Tree
  public TreeNode bulkLoad(FileStore store, Stored stored, int currentDepth, int maxDepth) {
    if ( stored == null )
      return null;

    TreeNode node = StoredTreeNode.Load(store, stored);

    if ( maxDepth > 0 && currentDepth >= maxDepth )
      return node;

    StoredTreeNode stn = (StoredTreeNode) node.getStored();

    TreeNode left = bulkLoad(store, stn.getLeft(), currentDepth + 1, maxDepth);
    node.setLeft(left);
    stn.setLeft(null);

    TreeNode right = bulkLoad(store, stn.getRight(), currentDepth + 1, maxDepth);
    node.setRight(right);
    stn.setRight(null);

    node.setStored(null);
    return node;
  }

  public void init() {
    if ( formatter_ == null ) {
      formatter_ = new JSONFObjectFormatter(store_.getX());
      formatter_.setPropertyPredicate(new StoragePropertyPredicate());
      formatter_.setOutputShortNames(true);
    }

    if ( ! loaded_ ) {
      loaded_ = true;
      // state_ = bulkLoad(store_, store_.getRoot(), 0, 0);
      state_ = bulkLoad(store_, store_.getRoot(), 0, 1);
      // TODO: load strategy - time, depth, ... 
    }
  }

  // dump stack for debugging
  protected void printStack(String name, Deque s) {
    StringBuilder sb = new StringBuilder();
    Iterator iter = s.iterator();
    while ( iter.hasNext() ) {
      Object o = iter.next();
      if ( o instanceof TreeNode ) {
        sb.append(((TreeNode) o).getKey());
        sb.append(",");
      } else {
        Stored stored = (Stored) o;
        Object obj = stored.get();
        sb.append(((StoredTreeNode)obj).getKey());
        sb.append("S");
        sb.append(",");
      }
    }
    Loggers.logger(store_.getX(), this).info(name, sb.toString());
  }
}
