/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.app.test;

import foam.core.app.*;
import foam.lang.X;

public class AppConfigCopyFromJavaTest
  extends foam.core.test.JavaTest {

  public void runTest(X x) {
    AppConfig to = new AppConfig();
    to.setMode(Mode.PRODUCTION);
    to.setUrl("http://to-url");

    AppConfig from = new AppConfig();
    from.setMode(Mode.TEST);
    from.setUrl("http://from-url");

    to.copyFrom(from);
    test ( to.getMode() == Mode.PRODUCTION, "Mode not copied");
    test ( to.getUrl().equals("http://from-url"), "Url copied");
  }
}
