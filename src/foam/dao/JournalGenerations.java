/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.dao;

import foam.core.fs.FileSystemStorage;
import foam.lang.X;
import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * The generations of one journal, derived from the filesystem rather than from
 * stored state.
 *
 * A journal accumulates numbered generations beside its live file. For a
 * journal named "foo":
 *
 *   foo             the live journal, always this name, written to
 *   foo.0           generation 0, immutable, ships in the resources jar
 *   foo.N           generation N, frozen by a cutover
 *   foo.N.gz        generation N, compressed
 *   foo.N.snap.gz   the complete state through generation N
 *   *.tmp           half written, discardable -- always derived data
 *
 * Replay is every generation in ascending order, then the live journal. A
 * snapshot through N supersedes every generation at or below N, so those are
 * skipped and may be deleted at any time: an interrupted cleanup costs disk,
 * never correctness.
 *
 * Only .snap.gz claims completeness. A plain .gz is merely a compressed
 * generation, so compressing one by hand stays safe.
 *
 * Generation 0 is not listed here. It lives in the jar, is read through
 * Storage rather than FileSystemStorage, and JDAO always replays it first.
 */
public class JournalGenerations {

  protected final static String SNAPSHOT_SUFFIX = ".snap.gz";
  protected final static String GZIP_SUFFIX     = ".gz";
  protected final static String TEMP_SUFFIX     = ".tmp";

  /** One generation file, ordered by generation then by snapshots winning ties. */
  protected static class Generation
    implements Comparable<Generation>
  {
    final String  name;
    final long    number;
    final boolean snapshot;

    Generation(String name, long number, boolean snapshot) {
      this.name     = name;
      this.number   = number;
      this.snapshot = snapshot;
    }

    public int compareTo(Generation o) {
      if ( number != o.number ) return Long.compare(number, o.number);
      // A snapshot replaces the generation it shares a number with, so it
      // replays after it on the way to being deleted.
      return Boolean.compare(snapshot, o.snapshot);
    }
  }

  protected final String           filename_;
  protected final List<Generation> generations_ = new ArrayList<>();

  public JournalGenerations(X x, String filename) {
    filename_ = filename;

    File dir = x.get(FileSystemStorage.class).get(filename).getParentFile();
    File[] files = dir == null ? null : dir.listFiles();
    if ( files == null ) return;

    // A partitioned journal's name carries its directory ("parts/7"), while a
    // listing yields bare names ("7.1"). Match on the bare name, and hand back
    // names the caller can pass straight to Storage -- the same form it gave us.
    int    slash  = filename.lastIndexOf('/');
    String dirPart = slash < 0 ? "" : filename.substring(0, slash + 1);
    String base    = slash < 0 ? filename : filename.substring(slash + 1);
    String prefix  = base + ".";

    for ( File f : files ) {
      if ( f.isDirectory() ) continue;
      String name = f.getName();
      if ( ! name.startsWith(prefix) ) continue;

      Generation g = parse(dirPart, name, prefix);
      if ( g != null ) generations_.add(g);
    }
    Collections.sort(generations_);
  }

  /**
   * The generation a name denotes, or null when the name is not one: a .tmp,
   * generation 0, or an unrelated file that merely shares the prefix.
   */
  protected Generation parse(String dirPart, String name, String prefix) {
    String rest = name.substring(prefix.length());

    // Half-written files are always derived data, so they are ignored here and
    // may be deleted. Checked explicitly rather than left to fall out of the
    // number parse, so the rule survives a change to the parsing.
    if ( rest.endsWith(TEMP_SUFFIX) ) return null;

    boolean snapshot = rest.endsWith(SNAPSHOT_SUFFIX);
    if ( snapshot ) {
      rest = rest.substring(0, rest.length() - SNAPSHOT_SUFFIX.length());
    } else if ( rest.endsWith(GZIP_SUFFIX) ) {
      rest = rest.substring(0, rest.length() - GZIP_SUFFIX.length());
    }

    long number;
    try {
      number = Long.parseLong(rest);
    } catch (NumberFormatException e) {
      return null;
    }

    // Generation 0 is the jar resource and is replayed by JDAO from Storage.
    // A dev tree with no resource jar has it on disk too; counting it here
    // would replay it twice.
    if ( number < 1 ) return null;

    return new Generation(dirPart + name, number, snapshot);
  }

  /** Highest generation with a complete snapshot, or 0 when there is none. */
  public long snapshotGeneration() {
    long g = 0;
    for ( Generation gen : generations_ ) {
      if ( gen.snapshot && gen.number > g ) g = gen.number;
    }
    return g;
  }

  /**
   * Files to replay, in order, between generation 0 and the live journal.
   * Everything a snapshot supersedes is left out.
   */
  public List<String> replayOrder() {
    long           snap  = snapshotGeneration();
    List<String>   names = new ArrayList<>();
    for ( Generation g : generations_ ) {
      if ( g.number < snap ) continue;
      if ( g.number == snap && ! g.snapshot ) continue;
      names.add(g.name);
    }
    return names;
  }

  /**
   * Files a snapshot has superseded. Deleting them reclaims disk and changes
   * nothing that replayOrder() returns, so it can happen whenever -- or never.
   */
  public List<String> superseded() {
    long         snap  = snapshotGeneration();
    List<String> names = new ArrayList<>();
    for ( Generation g : generations_ ) {
      if ( g.number < snap || ( g.number == snap && ! g.snapshot ) ) names.add(g.name);
    }
    return names;
  }

  /** The number a cutover should freeze the live journal under. */
  public long nextGeneration() {
    long max = 0;
    for ( Generation g : generations_ ) {
      if ( g.number > max ) max = g.number;
    }
    return max + 1;
  }
}
