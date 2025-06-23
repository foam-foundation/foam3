/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.box.socket;

import foam.lang.X;
import foam.lang.FObject;
import foam.box.Box;
import foam.box.SessionServerBox;
import foam.core.logger.Logger;
import foam.core.http.ServiceWebAgent;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

public class SocketWebAgent
  extends ServiceWebAgent
{
  public SocketWebAgent(Box skeleton, boolean authenticate) {
    super(skeleton, authenticate);
  }

  @Override
  public void execute(X x) {
    // TODO This is not actually used, SocketRouter uses this case but pulls the skeleton box out of it directly
    throw new RuntimeException("unimplemented");
  }
}
