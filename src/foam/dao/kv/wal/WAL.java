/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.dao.kv.wal;


class WAL {

  enum RecordType {
    PADDING(0),  // The rest of the block will be zero-filled padding.
    FULL(1),     // A complete record is in a single block.
    HEAD(2),     // A record is partitioned in to multiple block. This is the head of the record.
    MIDDLE(3),   // Entire block is dedicated for a record, as a record is bigger than the block size.
    LAST(4);     // The last partition of a record.

    private final int code;

    RecordType(int code) {
        this.code = code;
    }

    int getCode() {
      return this.code;
    }

    static RecordType fromCode(byte code) {
      return switch ( code ) {
        case 0 -> PADDING;
        case 1 -> FULL;
        case 2 -> HEAD;
        case 3 -> MIDDLE;
        case 4 -> LAST;
        default -> throw new AssertionError(String.format("invalid RecordType code: %d", code));
      };
    }
  }
}