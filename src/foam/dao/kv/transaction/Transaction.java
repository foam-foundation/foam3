/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.dao.kv.transaction;

import java.util.Comparator;
import java.util.TreeMap;
import java.util.Optional;
import java.util.Arrays;
import java.util.List;

class Transaction {

  static enum Mode {
    READ_WRITE,
    READ_ONLY,
    WRITE_ONLY;

    boolean isMutable() {
      return switch ( this ) {
        case READ_WRITE -> true;
        case READ_ONLY -> false;
        case WRITE_ONLY -> true;
      };
    }

    boolean isReadOnly() {
      return this == READ_ONLY;
    }

    boolean isWriteOnly() {
      return this == WRITE_ONLY;
    }
  }

  // Modes for durability.
  static enum DuraMode {
    GROUP_COMMIT,
    IMMEDIATE
  }

  static record Entry (
    byte[] key,
    Optional<byte[]> value, // empty() == true => It is a delete entry.
    long seqNum,             // write order within a transaction
    long timestamp
  ) {

  }

  static final long COMMIT_TIME = 0;

  Mode mode_;
  TreeMap<byte[], List<Entry>> writeSet_ = new TreeMap<>(Arrays::compare); //TODO: update compare method.
  boolean terminated_;
  long initSeqNum_;
  long writeSeqNo_;

  long nextWriteSeqNo() {
    return ++writeSeqNo_;
  }


  void set(byte[] key, byte[] value) {

    long writeSeqNo = nextWriteSeqNo();
    //TODO: create new entry.
    Entry entry = new Entry(key, Optional.of(value), writeSeqNo, 0L);
  }

  void write(Entry entry) {

  }

  void commit() {
    
  }
}