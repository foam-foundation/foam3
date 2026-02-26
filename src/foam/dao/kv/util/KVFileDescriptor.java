/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.dao.kv.util;

import java.util.List;
import java.util.ArrayList;
import java.io.IOException;

public interface KVFileDescriptor {

  long write(byte[] buffer) throws IOException;
  void flush() throws IOException;
  void close() throws IOException;
  void seek(long from) throws IOException;
  long read(byte[] buffer) throws IOException;
  long readAll(byte[] buffer) throws IOException;
  void lock() throws IOException;
  void unlock() throws IOException;
  long readAt(long offset, byte[] buffer) throws IOException;
  long writeAt(long offset, byte[] buffer) throws IOException;
  void sync() throws IOException;
  long size() throws IOException;
  
}