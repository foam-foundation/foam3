/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.partition;

import foam.core.logger.Loggers;
import foam.dao.AbstractSink;
import foam.dao.DAO;
import foam.lang.ClassInfo;
import foam.lang.Detachable;
import foam.lang.FObject;
import foam.lang.PropertyInfo;
import foam.lang.ReferencePropertyInfo;
import foam.lang.X;
import foam.util.SafetyUtil;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Rewrites references held by other DAOs after SingleToPartitionMigrator
 * changed a DAO's ids, using the oldId->newId map captured during migration.
 * Runs synchronously inside the migration pass, before the legacy journal is
 * archived — the archive is the completion marker, so a crash anywhere leaves
 * the legacy journal alongside populated partitions, which the migrator's
 * pre-flight guard reports loudly as a partial migration on the next boot.
 *
 * Referencing DAOs are discovered from cSpecDAO rows: each served DAO's client
 * spec names its model ("of"), and the model's Reference properties expose
 * their target DAO via ReferencePropertyInfo. No per-DAO configuration.
 *
 * Constraint: fixup runs during the target DAO's construction and x.get()s
 * each referencing DAO. If two partitioned DAOs ever reference each other,
 * their constructions would recurse — revisit the orchestration then.
 */
public class ReferenceMigrator {

  protected final String daoKey_;

  public ReferenceMigrator(String daoKey) {
    daoKey_ = daoKey;
  }

  /** Rewrite every reference to a migrated id. Returns true when all
      referencing DAOs were processed. */
  public boolean fixReferences(X x, Map<String,String> idMap) {
    if ( idMap.isEmpty() ) return true;
    boolean complete = true;
    for ( Object[] ref : discoverReferencers(x) ) {
      complete &= fixupDAO(x, (String) ref[0], (PropertyInfo) ref[1], idMap);
    }
    return complete;
  }

  /** (daoName, PropertyInfo) pairs for every served DAO whose model declares a
      Reference property targeting daoKey_. cSpecDAO rows are fully loaded
      before any service instantiates (Boot), so the scan is complete whenever
      this runs. */
  public List<Object[]> discoverReferencers(X x) {
    List<Object[]> found = new ArrayList<>();
    DAO cspecDAO = (DAO) x.get("cSpecDAO");
    cspecDAO.inX(x).select(new AbstractSink() {
      public void put(Object o, Detachable sub) {
        foam.core.boot.CSpec sp = (foam.core.boot.CSpec) o;
        String of = extractOf(sp.getClient());
        if ( SafetyUtil.isEmpty(of) ) return;
        ClassInfo info = classInfoFor(of);
        if ( info == null ) return;
        for ( Object a : info.getAxiomsByClass(PropertyInfo.class) ) {
          if ( a instanceof ReferencePropertyInfo &&
               daoKey_.equals(((ReferencePropertyInfo) a).getTargetDAOKey()) ) {
            found.add(new Object[] { sp.getName(), a });
          }
        }
      }
    });
    return found;
  }

  /** Extract the model id from a CSpec client spec by locating the "of" key
      and reading its quoted string value. Deliberately textual: foam's JSON
      parser is FObject-oriented and would instantiate the client spec's
      objects (and requires a context) just to read one key. Client specs are
      machine-written JSON, so a literal "of" inside an unrelated string value
      is not a practical concern. */
  public String extractOf(String client) {
    if ( SafetyUtil.isEmpty(client) ) return null;
    int i = client.indexOf("\"of\"");
    if ( i == -1 ) return null;
    int colon = client.indexOf(':', i + 4);
    if ( colon == -1 ) return null;
    int q1 = client.indexOf('"', colon + 1);
    int q2 = q1 == -1 ? -1 : client.indexOf('"', q1 + 1);
    if ( q2 == -1 ) return null;
    return client.substring(q1 + 1, q2);
  }

  protected ClassInfo classInfoFor(String id) {
    try {
      return (ClassInfo) Class.forName(id).getMethod("getOwnClassInfo").invoke(null);
    } catch ( Throwable t ) {
      return null; // client-only or unbundled model — nothing to fix server-side
    }
  }

  /** Stream one referencing DAO and rewrite every ref present in idMap.
      Returns false only when the DAO can't be processed at all. Refs not in
      the map (already-composite, dangling, foreign) are left untouched. */
  public boolean fixupDAO(X x, String refDaoName, PropertyInfo refProp, Map<String,String> idMap) {
    DAO dao = (DAO) x.get(refDaoName);
    if ( dao == null ) {
      Loggers.logger(x, this).warning("Referencing DAO not found:", refDaoName);
      return false;
    }
    final long[] rewritten = new long[1];
    dao.inX(x).select(new AbstractSink() {
      public void put(Object o, Detachable sub) {
        FObject record = (FObject) o;
        Object refVal = refProp.get(record);
        if ( ! ( refVal instanceof String ) ) return;
        String newId = idMap.get(refVal);
        if ( newId == null ) return;
        FObject clone = record.fclone();
        refProp.set(clone, newId);
        dao.inX(x).put(clone);
        rewritten[0]++;
      }
    });
    Loggers.logger(x, this).info("Reference fixup:", refDaoName, refProp.getName(),
      "rewritten", rewritten[0]);
    return true;
  }
}
