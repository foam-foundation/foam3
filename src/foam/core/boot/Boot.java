/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.boot;

import foam.core.auth.Group;
import foam.core.auth.Subject;
import foam.core.auth.User;
import foam.core.logger.Logger;
import foam.core.logger.ProxyLogger;
import foam.core.logger.StdoutLogger;
import foam.core.script.Script;
import foam.core.session.Session;
import foam.dao.AbstractSink;
import foam.dao.ArraySink;
import foam.dao.DAO;
import foam.dao.ProxyDAO;
import foam.dao.java.JDAO;
import foam.lang.*;
import static foam.mlang.MLang.EQ;
import foam.util.SafetyUtil;
import java.lang.Exception;
import java.net.JarURLConnection;
import java.net.URL;
import java.util.*;
import java.util.jar.Attributes;
import java.util.jar.Manifest;

public class Boot {
  // Context key used to store the top-level root context in the context.
  public final static String ROOT      = "_ROOT_";
  public final static String BOOT_TIME = "BOOT_TIME";

  protected DAO                       serviceDAO_;
  protected X                         root_      = new MutableX();
  protected Map<String, CSpecFactory> factories_ = new HashMap<>();
  protected static Map<String,String> ARGS       = new HashMap<>();

  public Boot() {
    XLocator.set(root_);

    Logger logger = new ProxyLogger(StdoutLogger.instance());
    root_.put("logger", logger);
    root_.put(BOOT_TIME, System.currentTimeMillis());

    boolean cluster = SafetyUtil.equals("true", System.getProperty("CLUSTER", "false"));

    String datadir = ARGS.get("datadir");
    if ( SafetyUtil.isEmpty(datadir) ) {
      datadir = System.getProperty("JOURNAL_HOME");
    }

    foam.core.fs.Storage storage = new foam.core.fs.FileSystemStorage(datadir);
    root_.put(foam.core.fs.FileSystemStorage.class, storage);

    var readStorage = storage;
    if ( ! SafetyUtil.isEmpty(System.getProperty("resource.journals.dir")) ) {
      readStorage = new foam.core.fs.ResourceStorage(System.getProperty("resource.journals.dir"));
    }
    root_.put(foam.core.fs.Storage.class, readStorage);

    // Used for all the services that will be required when Booting
    foam.dao.MDAO mdao = new foam.dao.MDAO(CSpec.getOwnClassInfo());
    mdao.addIndex(CSpec.SERVE);
    serviceDAO_ = new JDAO(((foam.lang.ProxyX) root_).getX(), mdao, "services", cluster);
    serviceDAO_ = new foam.core.auth.PermissionedPropertyDAO(root_, serviceDAO_);

    installSystemUser();

    // Just adding services in order will create an un-ordered tree,
    // so add so that we get a balanced Context tree.
    ArraySink arr = (ArraySink) serviceDAO_.select(new ArraySink());
    List      l   = perfectList(arr.getArray());

    // Record all sub contexts to be frozen along with the root context
    var subContexts = new HashSet<String>();
    for ( int i = 0 ; i < l.size() ; i++ ) {
      CSpec sp = (CSpec) l.get(i);
      if ( ! sp.getEnabled() ) {
        logger.info("Disabled", sp.getName());
        continue;
      }

      var x      = root_;
      var path   = sp.getName().split("/");
      var parent = new StringBuilder();

      // Register path as sub context
      for ( int j = 0 ; j < path.length - 1 ; j++ ) {
        var contextName = path[j];
        if ( x.get(contextName) == null ) {
          var subX = new SubX(Boot.this::getX, parent.toString());
          x.put(contextName, subX);
        }
        x = (X) x.get(contextName);

        if ( parent.length() > 0 ) parent.append("/");
        parent.append(contextName);
        subContexts.add(parent.toString());
      }

      // Register service
      var serviceName = path[path.length - 1];
      CSpecFactory factory = new CSpecFactory((ProxyX) x, sp);
      factories_.put(sp.getName(), factory);
      logger.info("Registering", sp.getName());
      x.putFactory(serviceName, factory);

      // Register link to the service added to the sub context, allowing the
      // service to be accessible via both the sub context and the root context.
      // Eg. "foo/test" nspec can be instantiated by
      //
      //      x.cd("foo").get("test");
      // or
      //      x.get("foo/test");
      //
      if ( x != root_ )
        root_.putFactory(sp.getName(), factory);
    }

    serviceDAO_.listen(new AbstractSink() {
      @Override
      public void put(Object obj, Detachable sub) {
        CSpec sp = (CSpec) obj;
        factories_.get(sp.getName()).invalidate(sp);
      }
    }, null);

    new ShutdownHook(root_, factories_);

    // Use an XFactory so that the root context can contain itself.
    root_.putFactory(ROOT, new XFactory() {
      public Object create(X x) {
        return Boot.this.getX();
      }
    });

    root_.putFactory("user", new XFactory() {
      public Object create(X x) {
        logger.warning(new Exception("Deprecated use of x.get(\"user\")"));
        return ((Subject) x.get("subject")).getUser();
      }
    });

    root_.putFactory("agent", new XFactory() {
      public Object create(X x) {
        logger.warning(new Exception("Deprecated use of x.get(\"agent\")"));
        return ((Subject) x.get("subject")).getRealUser();
      }
    });

    // Freeze sub contexts
    for ( var path : subContexts ) {
      var x = root_.cd(path);
      if ( x instanceof SubX ) {
        ((SubX) x).freeze();
      }
    }

    // Revert root_ to non ProxyX to avoid letting children add new bindings.
    root_ = ((ProxyX) root_).getX();
    XLocator.set(root_);

    // Export the ServiceDAO
    ((ProxyDAO) root_.get("cSpecDAO")).setDelegate(
      new foam.core.auth.AuthorizationDAO.Builder(getX())
        .setDelegate(serviceDAO_)
        .setAuthorizer(new foam.core.auth.AuthorizableAuthorizer("service"))
        .build());

    String bootScript = ARGS.get("boot.script");
    if ( SafetyUtil.isEmpty(bootScript) ) {
      logger.warning("ARG boot.script not found");
      bootScript = System.getProperty("foam.main", "main");
    }
    if ( bootScript != null ) {
      DAO scriptDAO = (DAO) root_.get("bootScriptDAO");
      if ( scriptDAO == null ) {
        logger.warning("DAO Not Found: bootScriptDAO. Falling back to scriptDAO");
        scriptDAO = (DAO) root_.get("scriptDAO");
      }
      Script script = (Script) scriptDAO.find(bootScript);
      if ( script != null ) {
        logger.info("Boot,bootScript", bootScript);
        ((Script) script.fclone()).runScript(root_);
      } else {
        logger.warning("Boot,bootScript not found", bootScript);
      }
    }

    serviceDAO_.where(EQ(CSpec.LAZY, false)).select(new AbstractSink() {
      @Override
      public void put(Object obj, Detachable sub) {
        CSpec sp = (CSpec) obj;

        logger.info("Invoking Service", sp.getName());
        root_.get(sp.getName());
      }
    });
  }

  protected List perfectList(List src) {
    List dst = new ArrayList(src.size());
    perfectList(src, dst, 0, src.size()-1);
    return dst;
  }

  protected void perfectList(List src, List dst, int start, int end) {
    if ( start == end ) {
      dst.add(src.get(start));
    } else if ( end > start ) {
      int pivot = ( start + end ) / 2;
      perfectList(src, dst, pivot, pivot);
      perfectList(src, dst, start, pivot-1);
      perfectList(src, dst, pivot+1, end);
    }
  }

  protected void installSystemUser() {
    User user = new User();
    user.setId(User.SYSTEM_USER_ID);
    String spid = ARGS.get("spid");
    if ( SafetyUtil.isEmpty(spid) )
      spid = "foam";
    user.setSpid(spid);
    user.setFirstName("system");
    user.setGroup("system");
    user.setLoginEnabled(false);

    Session session = new Session();
    session.setUserId(user.getId());
    session.setContext(root_);

    Subject subject = new Subject();
    subject.setUser(user);
    root_.put("subject", subject);
    root_.put(Session.class, session);

    Group group = new Group();
    group.setId("system");
    root_.put("group", group);
  }

  public X getX() { return root_; }

  public static String[] getManifestArgs() {
    try {
      String className = Boot.class.getSimpleName() + ".class";
      String classPath = Boot.class.getResource(className).toString();
      if ( ! classPath.startsWith("jar") ) {
        return new String[0];
      }
      URL url = new URL(classPath);
      JarURLConnection jarConnection = (JarURLConnection) url.openConnection();
      Manifest manifest = jarConnection.getManifest();
      Attributes attributes = manifest.getMainAttributes();
      String args = attributes.getValue("Args");
      if ( SafetyUtil.isEmpty(args) ) {
        return new String[0];
      }
      return args.split(",");
    } catch (Throwable t ) {
      System.err.println("Failed to acquire 'Args' from manifest. " + t.getMessage());
      return new String[0];
    }
  }

  public static void main (String[] args)
    throws java.lang.Exception
  {
    System.out.println("Starting CORE Server");
    if ( args != null && args.length > 0 ) {
      System.out.println("with: " + java.util.Arrays.toString(args));
    }

    if ( args == null || args.length == 0 ) {
      args = getManifestArgs();
    }

    for ( int i = 0 ; i < args.length ; i++ ) {
      String arg = args[i];
      if ( arg.startsWith("--") )
        arg = arg.substring(2);

      String[] kv = null;
      String   k  = arg;
      String   v  = null;

      if ( arg.contains(":")) {
        kv = arg.split(":");
      } else if ( arg.contains("=")) {
        kv = arg.split("=");
      }
      if ( kv != null ) {
        k = kv[0];
        v = kv.length == 2 ? kv[1] : "";
      }
      ARGS.put(k, v);
    }

    new Boot();
  }
}
