/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.dao.kv;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicLong;

/**
 * The core of Log Structured Merge tree.
 */
class LSMCore {

  Object activeMemtable_;
  Object immutableMemtables_;
  LSMOptions lsmOptions_;
  Object walManager_;

  AtomicLong visibleSeqNo_;

  /**
   * Intial LSMCore
   */
  LSMCore(LSMOptions options) {
    lsmOptions_ = Objects.requireNonNull(options, "LSMOptions should not be null");

    //TODO: file lock.
    //TODO: init immutable memtables.

    //TODO: init Manifest, get required WAL
    //TODO: init WAL
    //TODO: init memtable from WAL
    //TODO: init LSM level
  }
}