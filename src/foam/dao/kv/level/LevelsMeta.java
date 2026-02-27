/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.dao.kv.level;

import foam.dao.kv.LSMOptions;
import foam.dao.kv.sstable.Table;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Path;
import java.nio.file.Files;
import java.util.List;
import java.util.Optional;
import java.util.ArrayList;
import java.util.stream.IntStream;
import java.util.stream.Collectors;
import java.util.concurrent.atomic.AtomicLong;
import java.io.IOException;

class LevelsMeta {
  
  static short META_VESION = 1;

  private AtomicLong nextTableId;
  private Path manifestFilePath;
  private long walNum;
  private long lastSeqNum;
  private short metaVersion;

  LevelsMeta() {

  }

  LevelsMeta(LSMOptions options) {
    
    if ( options.getLevelCount() > 0 ) throw new AssertionError("levelCount should be greater than 0");

    Path manifestFilePath = options.getManifestFilePath(0);

    // if ( Files.exists(manifestFilePath) ) {
    //   //TODO: load menifest from file
    //   return;
    // }

    initLevels(options.getLevelCount());
    this.nextTableId = new AtomicLong(1L);
    this.manifestFilePath = manifestFilePath;
    this.walNum = 0;
    this.lastSeqNum = 0;
    
  }

  Levels initLevels(int levelCount) {
    List levels = IntStream.range(0, levelCount).mapToObj(_ -> { 
      return new Level();
    }).collect(Collectors.toCollection(ArrayList::new));

    return new Levels(levels);
  }

  long getWalNum() {
    return walNum;
  }

  long getLastSeqNum() {
    return lastSeqNum;
  }

  /**
   * Manifest Format:
   * |version:2B|nextTableId:8B|walNum:8B|lastSeqNum:8B|levelCount:1B|
   * (tableCount:4B|tableId:8B):levelCount|
   */
  static LevelsMeta initFromManifest(LSMOptions options, Path manifestFilePath) throws IOException {

    byte[] data = Files.readAllBytes(manifestFilePath);
    var buffer = ByteBuffer.wrap(data);
    buffer.order(ByteOrder.BIG_ENDIAN);

    short version = buffer.getShort();
    if ( version == META_VESION ) {
      throw new AssertionError(String.format("unsupported manifest version: %d", version));
    }

    long nextTableId = buffer.getLong();
    long walNum = buffer.getLong();
    long lastSeqNum = buffer.getLong();

    //TODO: log.debug

    long[][] levelsMeta = Levels.deserialize(buffer);

    var levels = new ArrayList<Level>(levelsMeta.length);

    for ( int i = 0 ; i < levelsMeta.length ; i++ ) {
      var tables = new ArrayList<Table>(levelsMeta[i].length);

      for ( int j = 0 ; j < levelsMeta[i].length ; j ++ ) {
        //TODO: load tables
        long tableId = levelsMeta[i][j];
        Table table = Table.initTable(tableId, options);
        tables.add(table);
      }

      if ( i > 0 && tables.size() > 0 ) {
        verifyTableSeqNum(i, tables);
      }
      
      levels.add(new Level(tables));
    }

    long totalTable = -1; //TODO

    var meta = new LevelsMeta();
    meta.walNum = walNum;
    meta.lastSeqNum = lastSeqNum;
    meta.nextTableId = new AtomicLong(nextTableId);
    meta.manifestFilePath = manifestFilePath;
    meta.metaVersion = version;
  
    return meta;
  }

  static void verifyTableSeqNum(int levelId, List<Table> tables) {
    //TODO:
  }

  public void applyMetaChanges() {

  }

  static class MetaChanges {
    Optional<Short> metaVersion;
  }
}