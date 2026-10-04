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
 * (images, links, bold, italic, code spans, deep headings) is stripped
 * in the grammar actions via stripInline().
 *
 * Returns a List of Section objects:
 *   level   — heading depth (0 = preamble before the first heading)
 *   heading — plain-text heading title (empty for level-0 preamble)
 *   payload — heading text + section body, plain text, trimmed
 *
 * Usage:
 *   List<MarkdownChunkParser.Section> chunks =
 *       new MarkdownChunkParser(maxDepth).parseString(markdown);
 */
public class MarkdownChunkParser {

  // ── Public output type ───────────────────────────────────────────────────

  public static final class Section {
    public final int    level;
    public final String heading;
    public final String payload;

    public Section(int level, String heading, String payload) {
      this.level   = level;
      this.heading = heading;
      this.payload = payload;
    }

    @Override
    public String toString() {
      return "Section{level=" + level + ", heading=\"" + heading + "\", payload.len=" + payload.length() + "}";
    }
  }

  // ── Instance ─────────────────────────────────────────────────────────────

  private final int                    maxDepth;
  private final foam.lib.parse.Grammar grammar_;

  public MarkdownChunkParser() { this(2); }

  public MarkdownChunkParser(int maxDepth) {
    this.maxDepth = maxDepth;
    this.grammar_ = buildGrammar(maxDepth);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  public List<Section> parseString(String markdown) {
    if ( markdown == null || markdown.isEmpty() ) return Collections.emptyList();

    // prepend \n so the first heading is recognised by the anchored grammar
    String s = "\n" + (markdown.endsWith("\n") ? markdown : markdown + "\n");

    StringPStream ps = new StringPStream();
    ps.setString(s);
    ParserContext x  = new ParserContextImpl();

    PStream result = grammar_.parse(ps, x, "");
    if ( result == null ) return Collections.emptyList();

    Object val = result.value();
    if ( ! (val instanceof List) ) return Collections.emptyList();

    @SuppressWarnings("unchecked")
    List<Section> sections = (List<Section>) val;
    return sections;
  }

  // ── Grammar construction ─────────────────────────────────────────────────

  @SuppressWarnings({"unchecked", "rawtypes"})
  private foam.lib.parse.Grammar buildGrammar(int maxDepth) {
    foam.lib.parse.Grammar g = new foam.lib.parse.Grammar();

    // headingStart: lookahead anchored to \n — prevents matching inside deeper sequences
    g.addSymbol("headingStart", new Seq(
      Literal.create("\n"),
      new Repeat(Literal.create("#"), null, 1, maxDepth),
      Literal.create(" ")
    ));

    // flat O(n) string capture — no per-char alt overhead
    g.addSymbol("preamble",
      new Join(new Repeat(new Not(g.sym("headingStart"), AnyChar.instance()), 1)));

    g.addSymbol("payload",
      new Join(new Repeat(new Not(g.sym("headingStart"), AnyChar.instance()))));

    g.addSymbol("headingText",
      new Join(new Repeat(new Not(Literal.create("\n"), AnyChar.instance()))));

    // heading: \n + hashes + space + headingText + optional newline
    g.addSymbol("heading", new Seq(
      Literal.create("\n"),
      new Join(new Repeat(Literal.create("#"), null, 1, maxDepth)),
      Literal.create(" "),
      g.sym("headingText"),
      new foam.lib.parse.Optional(Literal.create("\n"))
    ));

    g.addSymbol("section", new Seq(g.sym("heading"), g.sym("payload")));

    g.addSymbol("START", new Seq(
      new foam.lib.parse.Optional(g.sym("preamble")),
      new Repeat(g.sym("section"))
    ));

    // ── Actions ──────────────────────────────────────────────────────────────

    // inline markup stripped in the action, not by a sub-grammar
    g.addAction("preamble",    (val, x) -> stripInline(val != null ? val.toString() : ""));
    g.addAction("headingText", (val, x) -> stripInline(val != null ? val.toString() : ""));
    g.addAction("payload",     (val, x) -> stripInline(val != null ? val.toString() : ""));

    g.addAction("heading", (val, x) -> {
      Object[] v      = (Object[]) val;
      // v[0]="\n", v[1]=hashes, v[2]=" ", v[3]=headingText, v[4]=optional"\n"
      String   hashes = v[1] != null ? v[1].toString() : "";
      String   title  = v[3] != null ? v[3].toString() : "";
      return new Object[] { hashes.length(), title };
    });

    g.addAction("section", (val, x) -> {
      Object[] v       = (Object[]) val;
      Object[] h       = (Object[]) v[0];
      String   rawBody = v[1] != null ? v[1].toString() : "";
      int      level   = (int)    h[0];
      String   heading = (String) h[1];
      String   payload = (heading + "\n" + rawBody).strip();
      return new Section(level, heading, payload);
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

  private static final Pattern IMG     = Pattern.compile("!\\[[^\\]]*\\]\\([^)]*\\)");
  private static final Pattern LINK    = Pattern.compile("\\[([^\\]]*)\\]\\([^)]*\\)");
  private static final Pattern BOLD2   = Pattern.compile("\\*\\*([^*]*)\\*\\*");
  private static final Pattern BOLD_   = Pattern.compile("__([^_]*)__");
  private static final Pattern ITALIC2 = Pattern.compile("\\*([^*]*)\\*");
  private static final Pattern ITALIC_ = Pattern.compile("_([^_]*)_");
  private static final Pattern CODE    = Pattern.compile("`([^`]*)`");
  private static final Pattern HEADING = Pattern.compile("^#+\\s+", Pattern.MULTILINE);

  private static String stripInline(String text) {
    text = IMG    .matcher(text).replaceAll("");
    text = LINK   .matcher(text).replaceAll("$1");
    text = BOLD2  .matcher(text).replaceAll("$1");
    text = BOLD_  .matcher(text).replaceAll("$1");
    text = ITALIC2.matcher(text).replaceAll("$1");
    text = ITALIC_.matcher(text).replaceAll("$1");
    text = CODE   .matcher(text).replaceAll("$1");
    text = text.replace("\n> ", "\n");
    text = HEADING.matcher(text).replaceAll("");
    return text;
  }
}
