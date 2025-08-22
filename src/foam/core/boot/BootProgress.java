/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.boot;

import foam.core.logger.Logger;
import foam.core.logger.StdoutLogger;
import foam.lang.X;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * A helper class which may aid in tracking down boot issues such as
 * deadlocked replay.
 * Enabled via build flag:
 * -EJAVA_OPTS=" -Dboot.progress=true"
 */
public class BootProgress {
  public final static Map<String, String> SERVICES = new ConcurrentHashMap();

  public static void UPDATE(String key, String value) {
    SERVICES.put(key, value);
    if ( Boolean.getBoolean("boot.progress") ) {
      DUMP();
    }
  }

  public static void DUMP() {
    Logger logger = StdoutLogger.instance();
    AtomicInteger incomplete = new AtomicInteger(0);
    AtomicInteger errors = new AtomicInteger(0);
    SERVICES.entrySet().stream()
      .sorted((e1, e2)->e1.getKey().compareTo(e2.getKey()))
      .forEach(e -> {
          if ( ! "Initialized".equals(e.getValue()) &&
               ! "Created".equals(e.getValue()) ) {
            incomplete.getAndIncrement();
            if ( e.getValue().startsWith("ERROR") ) {
              errors.getAndIncrement();
              incomplete.getAndDecrement();
            } else {
              logger.debug("Boot in progress", e.getKey(), e.getValue());
            }
          }
        });
    if ( incomplete.get() == 0 ) {
      if ( errors.get() > 0 ) {
        logger.warning("Boot COMPLETE, with errors", errors.get());
        SERVICES.entrySet().stream()
          .forEach(e -> {
              if ( e.getValue().startsWith("ERROR") ) {
                logger.warning("Boot error", e.getKey(), e.getValue());
              }
            }); 
      } else {
        // NOTE: complete at the moment, another factory may be invoked later.
        logger.info("Boot COMPLETE");
      }
    } else {
      logger.info("Boot summary - in progress", incomplete.get(), "errors", errors.get());
    }
  }
}
