package foam.dao.kv.level;

import java.util.List;
import java.util.ArrayList;
import java.nio.ByteBuffer;

class Levels {
  
  List<Level> levels;

  Levels(List<Level> levels) {
    this.levels = levels;
  }

  static long[][] deserialize(ByteBuffer buffer) {
    byte levelCount = buffer.get();

    long[][] levels = new long[levelCount][];

    for ( int i = 0 ; i < levelCount ; i++ ) {
      int tableCount = buffer.getInt();
      long[] tables = new long[tableCount];
      
      for ( int j = 0 ; j < tableCount ; j++ ) {
        long tableId = buffer.getLong();
        tables[j] = tableId;
      }
    }
    return levels;
  }
  
}