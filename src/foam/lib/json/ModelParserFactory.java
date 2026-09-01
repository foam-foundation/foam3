/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.json;

import foam.lang.ClassInfo;
import foam.lang.PropertyInfo;
import foam.lib.parse.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;

public class ModelParserFactory {
  protected final static ConcurrentHashMap<ClassInfo, Parser> parsers_ = new ConcurrentHashMap<ClassInfo, Parser>();
  protected final static Parser UNKNOWN_PROPERTY  = new UnknownPropertyParser();

  // Skip whitespace AND single-line // comments between structural tokens.
  // A single flat Parser (one virtual dispatch per skip) rather than the old
  // Repeat0(Alt(Seq0(Literal,Until),WS)) combinator stack — keeps the perf win
  // while preserving inline-comment tolerance in FObject bodies.
  protected final static Parser SKIP              = new Parser() {
    public PStream parse(PStream ps, ParserContext x) {
      while ( ps.valid() ) {
        char c = ps.head();
        if ( c == ' ' || c == '\t' || c == '\r' || c == '\n' ) {
          ps = ps.tail();
          continue;
        }
        if ( c == '/' ) {
          PStream next = ps.tail();
          if ( next.valid() && next.head() == '/' ) {
            ps = next.tail();
            while ( ps.valid() ) {
              char nc = ps.head();
              if ( nc == '\n' || nc == '\r' ) { ps = ps.tail(); break; }
              ps = ps.tail();
            }
            continue;
          }
        }
        break;
      }
      return ps;
    }
  };

  /**
   * Resolves a property key to its value parser: walk a ternary search tree
   * one character at a time. At each node, route left/right until the current
   * character matches the node's, then step down (mid_) to the next character:
   *
   *   keys "fee", "fen", "country":      [f]
   *                                     /   \
   *                                  [c]     (mid) [e]
   *                                 country        (mid) [e] — right — [n]
   *                                                     "fee"        "fen"
   *
   * seal() rebuilds the tree balanced (median-first insertion) once all names
   * are added, so left/right sibling chains stay short. Lookup allocates
   * nothing: it reads the key's characters in place and hops nodes; the
   * stream advances once, after the key is confirmed. A miss falls back to
   * UnknownPropertyParser — unknown keys skip as before.
   */
  static final class PropertyKeyParser implements Parser {
    // Ternary-search-tree node: left_/right_ route on the current character,
    // mid_ advances to the next one. parser_ != null marks a complete key.
    private static final class Node {
      final char c_;
      Node   left_, mid_, right_;
      Parser parser_;
      Node(char c) { c_ = c; }
    }

    private final ArrayList<String> names_        = new ArrayList<String>();
    private final ArrayList<Parser> valueParsers_ = new ArrayList<Parser>();
    private Node root_;
    private int  maxKeyLen_;

    void add(String name, Parser valueParser) {
      names_.add(name);
      valueParsers_.add(valueParser);
      if ( name.length() > maxKeyLen_ ) maxKeyLen_ = name.length();
    }

    /** Build the tree balanced: sort the names, insert medians first. */
    void seal() {
      Integer[] order = new Integer[names_.size()];
      for ( int i = 0 ; i < order.length ; i++ ) order[i] = i;
      Arrays.sort(order, (a, b) -> names_.get(a).compareTo(names_.get(b)));
      insertBalanced(order, 0, order.length - 1);
    }

    private void insertBalanced(Integer[] order, int lo, int hi) {
      if ( lo > hi ) return;
      int m = ( lo + hi ) >>> 1;
      root_ = insert(root_, names_.get(order[m]), 0, valueParsers_.get(order[m]));
      insertBalanced(order, lo, m - 1);
      insertBalanced(order, m + 1, hi);
    }

    private Node insert(Node n, String key, int d, Parser valueParser) {
      char c = key.charAt(d);
      if ( n == null ) n = new Node(c);
      if      ( c < n.c_ ) n.left_  = insert(n.left_,  key, d, valueParser);
      else if ( c > n.c_ ) n.right_ = insert(n.right_, key, d, valueParser);
      else if ( d < key.length() - 1 ) n.mid_ = insert(n.mid_, key, d + 1, valueParser);
      else n.parser_ = valueParser;
      return n;
    }

    public PStream parse(PStream ps, ParserContext x) {
      if ( ! ( ps instanceof StringPStream ) ) return parseGeneric(ps, x);

      StringPStream sps = (StringPStream) ps;
      CharSequence  str = sps.getString();
      int len = str.length();
      int p0  = sps.pos();
      if ( p0 >= len ) return null;

      boolean quoted = str.charAt(p0) == '"';
      int start = quoted ? p0 + 1 : p0;

      // find the key's end
      int i = start;
      for ( ; i < len ; i++ ) {
        char c = str.charAt(i);
        if ( ! ( c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '_' || c == '$' ) ) break;
      }
      int keyLen = i - start;
      if ( keyLen == 0 ) return null;
      if ( quoted ) {
        if ( i >= len || str.charAt(i) != '"' ) return null;
        i++;
      }

      // Walk the tree over the key's span. Reaching the end of the span on a
      // matching node takes that node's parser (null if no key ends there);
      // running out of nodes means the key is not a property.
      Node n = root_;
      int d = start, end = start + keyLen;
      Parser found = null;
      while ( n != null ) {
        char c = str.charAt(d);
        if      ( c < n.c_ ) n = n.left_;
        else if ( c > n.c_ ) n = n.right_;
        else {
          d++;
          if ( d == end ) { found = n.parser_; break; }
          n = n.mid_;
        }
      }
      return found == null ? null : found.parse(sps.createAt(i), x);
    }

    /** The same scan and lookup over any PStream — only the error-reporting streams take this path. */
    private PStream parseGeneric(PStream ps, ParserContext x) {
      if ( ! ps.valid() ) return null;

      boolean quoted = ps.head() == '"';
      if ( quoted ) ps = ps.tail();

      char[] buf = new char[maxKeyLen_];
      int nChars = 0;
      while ( ps.valid() ) {
        char c = ps.head();
        if ( ! ( c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '_' || c == '$' ) ) break;
        if ( nChars == buf.length ) return null; // longer than any registered name
        buf[nChars++] = c;
        ps = ps.tail();
      }
      if ( nChars == 0 ) return null;
      if ( quoted ) {
        if ( ! ps.valid() || ps.head() != '"' ) return null;
        ps = ps.tail();
      }

      Node n = root_;
      int d = 0;
      Parser found = null;
      while ( n != null ) {
        char c = buf[d];
        if      ( c < n.c_ ) n = n.left_;
        else if ( c > n.c_ ) n = n.right_;
        else {
          d++;
          if ( d == nChars ) { found = n.parser_; break; }
          n = n.mid_;
        }
      }
      return found == null ? null : found.parse(ps, x);
    }
  }

  public static Parser getInstance(ClassInfo ci) {
    if ( parsers_.containsKey(ci) ) return parsers_.get(ci);
    // Sync is required to avoid building one parser per AssemblyLine thread.
    synchronized ( ci ) {
      if ( parsers_.containsKey(ci) ) return parsers_.get(ci);

      Parser parser = buildInstance_(ci);
      parsers_.put(ci, parser);
      return parser;
    }
  }

  public static Parser buildInstance_(ClassInfo info) {
    List      properties = info.getAxiomsByClass(PropertyInfo.class);
    Iterator  iter       = properties.iterator();
    PropertyKeyParser keys = new PropertyKeyParser();

    while ( iter.hasNext() ) {
      final PropertyInfo pi = (PropertyInfo) iter.next();
      final Parser       pp = pi.jsonParser();

      // If javaJSONParser: null, then don't add a PropertyParser for this field
      if ( pp == null ) continue;

      //      System.err.println("PI " + pi.getName() + " " + pp);
      // Value parser: skip (ws + comments), match ':', skip, parse value, set
      // property. SKIP replaces the Seq0(SKIP, Literal(':'), SKIP, valueParser)
      // combinator layers with one dispatch per skip.
      Parser valueParser = new Parser() {
        public PStream parse(PStream ps, ParserContext x) {
          ps = SKIP.parse(ps, x);
          // Match ':'
          if ( ! ps.valid() || ps.head() != ':' ) return null;
          ps = ps.tail();
          ps = SKIP.parse(ps, x);
          // Parse value and set property
          ps = pp.parse(ps, x);
          if ( ps == null ) return null;
          pi.set(x.get("obj"), ps.value());
          return ps;
        }
      };

      keys.add(pi.getName(), valueParser);
      if ( pi.getShortName() != null ) keys.add(pi.getShortName(), valueParser);
    }

    keys.seal();

    // Inlined property loop: replaces Repeat0(Seq0(SKIP, Alt, SKIP), Literal(','))
    // to eliminate Repeat0 + Seq0 + Literal combinator overhead per property.
    final PropertyKeyParser finalKeys = keys;
    return new Parser() {
      final Parser unknownProperty = UNKNOWN_PROPERTY;

      public PStream parse(PStream ps, ParserContext x) {
        while ( true ) {
          // Skip whitespace and // comments before the property name
          ps = SKIP.parse(ps, x);

          // Resolve the property key, then unknown property fallback
          PStream result = finalKeys.parse(ps, x);
          if ( result == null ) {
            result = unknownProperty.parse(ps, x);
          }
          if ( result == null ) break;
          ps = result;

          // Skip trailing whitespace and // comments
          ps = SKIP.parse(ps, x);

          // Inline comma check (replaces Literal(',') delimiter in Repeat0)
          if ( ps.valid() && ps.head() == ',' ) {
            ps = ps.tail();
          } else {
            break;
          }
        }

        return ps;
      }
    };
  }
}
