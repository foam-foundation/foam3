/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.u2.parse;

import java.util.ArrayList;
import java.util.List;

/**
 * One node of the tree foam.u2.parse.CSSParser (Java) builds. The same node
 * model as the JS grammar in src/foam/u2/parse/CSSParser.js, whose class
 * documentation lists every kind and what each field means; the field names
 * here are the JS field names.
 *
 * Every node has kind, start, end (exclusive) and raw, where raw always
 * equals input.substring(start, end). A field that does not apply to a kind
 * stays null (or false).
 *
 * One Java difference: 'value' holds an Object because the JS field of that
 * name holds a string (ident, string, hash, url, operator, delim), a number
 * (number: a Double here) or, on a declaration, the value node. valueNode()
 * reads the last case without a cast.
 */
public class CSSNode {
  public String kind;
  public int    start;
  public int    end;
  public String raw;

  // Leaf data
  public Object       value;
  public String       unit;        // number: '' or 'px', '%', ...
  public String       quote;       // string
  public String       text;        // comment: text between the delimiters
  public String       placeholder; // comment: NAME of /*%NAME%*/
  public String       token;       // comment: '$name' when the text is exactly one token
  public String       name;        // token, placeholder, function, atrule, property
  public String       base;        // token
  public List<String> variants;    // token
  public String       cls;         // token: class of a class-scoped token
  public String       context;     // token: null, 'comment', 'string' or 'url'; caret: null, 'string' or 'comment'
  public String       message;     // error
  public Boolean      closed;      // null where the kind cannot be left open
  public boolean      isHexColor;  // hash
  public boolean      inMath;      // token
  public boolean      inAttr;      // caret
  public boolean      quoted;      // url
  public boolean      important;   // value, declaration
  public boolean      custom;      // declaration

  // Child nodes
  public CSSNode       property;   // declaration
  public CSSNode       prelude;    // atrule
  public CSSNode       arg;        // url: the string node when quoted
  public List<CSSNode> children;   // stylesheet, rule, atrule (null for a statement at-rule)
  public List<CSSNode> selectors;  // rule
  public List<CSSNode> parts;      // selector; custom property value; comment, string: tokens and carets inside
  public List<CSSNode> carets;     // selector, comment, string: parts filtered to kind 'caret'
  public List<CSSNode> tokens;     // selector, custom value: token parts; comment, string, url: tokens inside
  public List<CSSNode> components; // value, prelude, paren, bracket
  public List<CSSNode> args;       // function
  public List<CSSNode> comments;   // declaration: comments between property and ':'

  public CSSNode(String kind, int start, int end, String raw) {
    this.kind  = kind;
    this.start = start;
    this.end   = end;
    this.raw   = raw;
  }

  public CSSNode valueNode() {
    return value instanceof CSSNode ? (CSSNode) value : null;
  }

  /**
   * The child nodes in input order, per kind. This is the one list walk()
   * follows; it matches CHILD_KEYS in the JS grammar.
   */
  public List<CSSNode> childNodes() {
    List<CSSNode> out = new ArrayList<>();
    switch ( kind ) {
      case "stylesheet":  add(out, children); break;
      case "rule":        add(out, selectors); add(out, children); break;
      case "selector":    add(out, parts); break;
      case "atrule":      add(out, prelude); add(out, children); break;
      case "prelude":     add(out, components); break;
      case "declaration": add(out, property); add(out, comments); add(out, valueNode()); break;
      case "value":       add(out, components); add(out, parts); break;
      case "function":    add(out, args); break;
      case "paren":
      case "bracket":     add(out, components); break;
      case "url":         add(out, arg); add(out, tokens); break;
      case "comment":
      case "string":      add(out, parts); break;
      default:            break;
    }
    return out;
  }

  protected static void add(List<CSSNode> out, List<CSSNode> list) {
    if ( list != null ) out.addAll(list);
  }

  protected static void add(List<CSSNode> out, CSSNode n) {
    if ( n != null ) out.add(n);
  }

  public String toString() {
    return kind + "[" + start + "," + end + "]";
  }
}
