/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.ai.vector;

import foam.lib.parse.*;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Splits a markdown string into sections at heading boundaries.
 * Body text is collected as a flat string in O(n), then inline markup
 * (images, links, bold, italic, code spans) is stripped in the grammar
 * actions via stripInline().
 *
 * Returns a List of Section objects:
 *   level   — heading depth (0 = preamble before the first heading)
 *   heading — plain-text heading title (empty for level-0 preamble)
 *   body    — heading text + section body, plain text, trimmed
 *
 * Usage:
 *   List<MarkdownChunkParser.Section> chunks =
 *       MarkdownChunkParser.getInstance().parseString(markdown);
 */
public class MarkdownChunkParser {

  // ── Public output type ───────────────────────────────────────────────────

  public static final class Section {
    public final int    level;
    public final String heading;
    public final String body;

    public Section(int level, String heading, String body) {
      this.level   = level;
      this.heading = heading;
      this.body    = body;
    }

    @Override
    public String toString() {
      return "Section{level=" + level + ", heading=\"" + heading + "\", body.len=" + body.length() + "}";
    }
  }

  // ── Singleton ────────────────────────────────────────────────────────────

  private static final MarkdownChunkParser INSTANCE = new MarkdownChunkParser();

  public static MarkdownChunkParser getInstance() { return INSTANCE; }

  private final foam.lib.parse.Grammar grammar_;

  private MarkdownChunkParser() {
    grammar_ = buildGrammar();
  }

  // ── Public API ───────────────────────────────────────────────────────────

  public List<Section> parseString(String markdown) {
    if ( markdown == null || markdown.isEmpty() ) return Collections.emptyList();

    String s = markdown.endsWith("\n") ? markdown : markdown + "\n";

    StringPStream ps = new StringPStream();
    ps.setString(s);
    ParserContext x  = new ParserContextImpl();

    PStream result = grammar_.parse(ps, x, "");
    if ( result == null ) return Collections.emptyList();

    Object val = result.value();
    if ( val instanceof List ) {
      @SuppressWarnings("unchecked")
      List<Section> list = (List<Section>) val;
      return list;
    }
    return Collections.emptyList();
  }

  // ── Grammar construction ─────────────────────────────────────────────────

  @SuppressWarnings({"unchecked", "rawtypes"})
  private foam.lib.parse.Grammar buildGrammar() {
    foam.lib.parse.Grammar g = new foam.lib.parse.Grammar();

    // headingStart: lookahead — marks where body/preamble stop
    g.addSymbol("headingStart", new Seq(
      new Repeat(Literal.create("#"), null, 1, 6),
      Literal.create(" ")
    ));

    // flat O(n) string capture — no per-char alt overhead
    g.addSymbol("preamble",
      new Join(new Repeat(new Not(g.sym("headingStart"), AnyChar.instance()), 1)));

    g.addSymbol("body",
      new Join(new Repeat(new Not(g.sym("headingStart"), AnyChar.instance()))));

    g.addSymbol("headingText",
      new Join(new Repeat(new Not(Literal.create("\n"), AnyChar.instance()))));

    // heading: hashes + space + headingText + optional newline
    g.addSymbol("heading", new Seq(
      new Join(new Repeat(Literal.create("#"), null, 1, 6)),
      Literal.create(" "),
      g.sym("headingText"),
      new foam.lib.parse.Optional(Literal.create("\n"))
    ));

    g.addSymbol("section", new Seq(g.sym("heading"), g.sym("body")));

    g.addSymbol("START", new Seq(
      new foam.lib.parse.Optional(g.sym("preamble")),
      new Repeat(g.sym("section"))
    ));

    // ── Actions ──────────────────────────────────────────────────────────────

    // inline markup stripped in the action, not by a sub-grammar
    g.addAction("preamble",    (val, x) -> stripInline(val != null ? val.toString() : ""));
    g.addAction("headingText", (val, x) -> stripInline(val != null ? val.toString() : ""));
    g.addAction("body",        (val, x) -> stripInline(val != null ? val.toString() : ""));

    g.addAction("heading", (val, x) -> {
      Object[] v      = (Object[]) val;
      String   hashes = (String) v[0];
      String   title  = v[2] != null ? v[2].toString() : "";
      return new Object[] { hashes.length(), title };
    });

    g.addAction("section", (val, x) -> {
      Object[] v       = (Object[]) val;
      Object[] h       = (Object[]) v[0];
      String   rawBody = v[1] != null ? v[1].toString() : "";
      int      level   = (int)    h[0];
      String   heading = (String) h[1];
      String   body    = (heading + "\n" + rawBody).strip();
      return new Section(level, heading, body);
    });

    g.addAction("START", (val, x) -> {
      Object[]      v   = (Object[]) val;
      List<Section> out = new ArrayList<>();

      if ( v[0] != null ) {
        String preamble = v[0].toString().strip();
        if ( ! preamble.isEmpty() ) out.add(new Section(0, "", preamble));
      }

      if ( v[1] != null ) {
        for ( Object item : (Object[]) v[1] ) {
          if ( item instanceof Section ) out.add((Section) item);
        }
      }

      return out;
    });

    return g;
  }

  // ── Inline markup stripping ───────────────────────────────────────────────

  private static final Pattern IMG      = Pattern.compile("!\\[[^\\]]*\\]\\([^)]*\\)");
  private static final Pattern LINK     = Pattern.compile("\\[([^\\]]*)\\]\\([^)]*\\)");
  private static final Pattern BOLD2    = Pattern.compile("\\*\\*([^*]*)\\*\\*");
  private static final Pattern BOLD_    = Pattern.compile("__([^_]*)__");
  private static final Pattern ITALIC2  = Pattern.compile("\\*([^*]*)\\*");
  private static final Pattern ITALIC_  = Pattern.compile("_([^_]*)_");
  private static final Pattern CODE     = Pattern.compile("`([^`]*)`");

  private static String stripInline(String text) {
    text = IMG    .matcher(text).replaceAll("");
    text = LINK   .matcher(text).replaceAll("$1");
    text = BOLD2  .matcher(text).replaceAll("$1");
    text = BOLD_  .matcher(text).replaceAll("$1");
    text = ITALIC2.matcher(text).replaceAll("$1");
    text = ITALIC_.matcher(text).replaceAll("$1");
    text = CODE   .matcher(text).replaceAll("$1");
    text = text.replace("\n> ", "\n");
    return text;
  }
}
