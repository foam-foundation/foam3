/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.dao.kv.sstable;

import foam.dao.kv.LSMOptions;
import foam.dao.kv.util.KVFileDescriptor;

import java.util.List;
import java.util.ArrayList;
import java.io.IOException;

public class Table {

  long id;
  KVFileDescriptor file;

  LSMOptions lsmOptions;

  public Table(long id, LSMOptions lsmOptions, KVFileDescriptor file) {


  }

  static public Table initTable(long id, LSMOptions lsmOptions, KVFileDescriptor file) {

    // 1. Read footer.

    return null;
  }

  // public static enum Format {
    
  // }
}