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
import java.nio.file.Path;
import java.nio.channels.FileChannel;
import java.nio.file.StandardOpenOption;
import java.io.IOException;

public class Table {

  long id;
  long fileSize;
  KVFileDescriptor file;
  FileChannel fd;

  LSMOptions options;

  public Table() {

  }

  public Table(long id, LSMOptions options, KVFileDescriptor file) {


  }

  static public Table initTable(long id, LSMOptions options, KVFileDescriptor file) {

    // 1. Read footer.

    return null;
  }

  static public Table initTable(long id, LSMOptions options) throws IOException {

    Path tableFilePath = options.getSstableFilePath(id);

    FileChannel channel = FileChannel.open(tableFilePath, StandardOpenOption.READ);

    var table = new Table();
    table.id = id;
    table.fd = channel;
    table.fileSize = channel.size();
    table.options = options;
  
    return table;
  }

}