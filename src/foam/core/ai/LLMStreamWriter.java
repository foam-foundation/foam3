/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.ai;

import foam.core.auth.Subject;
import foam.core.logger.Loggers;
import foam.dao.DAO;
import foam.lang.FObject;
import foam.lang.X;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Writes one streamed call's reply to llmStreamDAO as it arrives. A provider
 * creates one when LLMOptions.streamId is set, calls append() per chunk and
 * finish() at the end. Rows are flushed at most every FLUSH_MS and removed
 * KEEP_MS after the call ends.
 *
 * Writes go through the DAO's own context (the server), since the caller
 * may only read its stream; the owner is taken from the caller's context.
 */
public class LLMStreamWriter {

  public static final long FLUSH_MS = 250;
  public static final long KEEP_MS  = 60000;

  static final ScheduledExecutorService CLEANUP = Executors.newSingleThreadScheduledExecutor(r -> {
    Thread t = new Thread(r, "LLMStreamWriter-cleanup");
    t.setDaemon(true);
    return t;
  });

  /** A writer for options.streamId, or null when the call is not streamed. */
  public static LLMStreamWriter forOptions(X x, LLMOptions options) {
    if ( options == null || foam.util.SafetyUtil.isEmpty(options.getStreamId()) ) return null;
    return new LLMStreamWriter(x, options.getStreamId());
  }

  protected final X             x_;
  protected final DAO           dao_;
  protected final String        id_;
  protected final long          owner_;
  protected final StringBuilder text_    = new StringBuilder();
  protected long                flushed_ = 0;

  public LLMStreamWriter(X x, String id) {
    Subject subject = (Subject) x.get("subject");
    x_     = x;
    dao_   = (DAO) x.get("llmStreamDAO");
    id_    = id;
    owner_ = subject == null || subject.getUser() == null ? 0 : subject.getUser().getId();
    put("thinking", "");
  }

  public String text() {
    return text_.toString();
  }

  public void append(String s) {
    if ( s == null || s.isEmpty() ) return;
    text_.append(s);
    if ( System.currentTimeMillis() - flushed_ >= FLUSH_MS ) put("writing", "");
  }

  public void finish(String error) {
    put("done", error == null ? "" : error);
    if ( dao_ == null ) return;
    CLEANUP.schedule(() -> {
      FObject row = dao_.find(id_);
      if ( row != null ) dao_.remove(row);
    }, KEEP_MS, TimeUnit.MILLISECONDS);
  }

  protected void put(String phase, String error) {
    flushed_ = System.currentTimeMillis();
    if ( dao_ == null ) return;
    try {
      dao_.put(new LLMStream.Builder(x_)
        .setId(id_)
        .setOwner(owner_)
        .setPhase(phase)
        .setText(text())
        .setError(error)
        .build());
    } catch ( RuntimeException e ) {
      Loggers.logger(x_, this).warning("llmStreamDAO put failed", id_, e);
    }
  }
}
