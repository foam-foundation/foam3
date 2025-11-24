/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * Java shutdown hook to allow for graceful stopping of services
 */
package foam.core.boot;

import foam.core.app.AppConfig;
import foam.core.app.Mode;
import foam.core.logger.Logger;
import foam.core.logger.Loggers;
import foam.lang.X;
import java.util.Map;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.FileSystem;
import java.nio.file.FileSystems;
import java.nio.file.Path;
import java.nio.file.Paths;

public class ShutdownHook
  extends Thread {

  protected X x_;
  protected Map<String, CSpecFactory> factories_ = null;

  public ShutdownHook(X x, Map factories) {
    x_ = x;
    factories_ = factories;

    Runtime.getRuntime().addShutdownHook(this);
    Loggers.logger(x).info("Shutdownhook,registered");
  }

  @Override
  public void run() {
    X x = x_;
    Logger logger = Loggers.logger(x_);
    logger.info("Shutdownhook,shutdown requested");

    // Interrupt this thread so JDAO.setDelegate() can detect we're in shutdown
    Thread.currentThread().interrupt();

    AppConfig appConfig = (AppConfig) x.get("appConfig");

    // Generate a thrump dump
    try {
      foam.core.http.ThreadsWebAgent agent = new foam.core.http.ThreadsWebAgent();
      FileSystem fs = FileSystems.getDefault();
      String tmp = System.getProperty("java.io.tmpdir", "tmp");
      String appName = appConfig.getName().trim().replaceAll(" ","");
      String hostname = System.getProperty("hostname", "localhost");
      if ( hostname.equals("localhost") ) {
        hostname = System.getProperty("user.name", "localhost");
      }

      Path path = fs.getPath(tmp, hostname, appName);
      if ( ! Files.exists(path) ) {
        path = Files.createDirectories(path);
      }
      path = path.resolve("threaddump.html");
      FileWriter fw = new FileWriter(path.toFile());
      PrintWriter pw = new PrintWriter(fw);
      X y = x_.put(PrintWriter.class, pw);
      agent.execute(y);
      fw.flush();
      logger.info("ShutdownHook,shutdown,Thread report", path.toString());
    } catch (Throwable t) {
      logger.warning("ShutdownHook,shutdown,Failed to generated thread report", t);
    }

    if ( factories_ != null &&
         appConfig.getMode() != foam.core.app.Mode.TEST ) {
      for ( CSpecFactory factory : factories_.values() ) {
        // Report factory shutdown to troubleshoot services not stoppinp
        logger.debug("Shutdownhook,shutdown,factory",factory.getCSpecName(),"start");
        factory.shutdown();
        logger.debug("Shutdownhook,shutdown,factory",factory.getCSpecName(),"end");
      }
    }

    logger.info("ShutdownHook,shutdown complete");
  }
}
