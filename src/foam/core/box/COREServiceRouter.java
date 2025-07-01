/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.box;

import foam.box.Skeleton;
import foam.lang.ContextAware;
import foam.lang.X;
import foam.dao.DAO;
import foam.dao.DAOSkeleton;
import foam.core.COREService;
import foam.core.boot.CSpec;
import foam.core.boot.CSpecAware;
import foam.core.logger.Logger;
import foam.core.pm.PM;
import jakarta.servlet.http.HttpServlet;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class COREServiceRouter
  extends    HttpServlet
  implements COREService, ContextAware
{
  protected X x_;

  protected Map<String, foam.box.Box> serviceMap_ = new ConcurrentHashMap<>();

  public void service(String serviceKey, foam.box.Envelope envelope) {
    PM            pm       = new PM(this.getClass(), serviceKey);
    Logger        logger   = (Logger)getX().get("logger");

    try {
      DAO         cSpecDAO = (DAO) getX().get("cSpecDAO");
      CSpec       spec     = (CSpec) cSpecDAO.find(serviceKey);
      foam.box.Box box     = getServiceBox(spec);

      if ( box == null ) {
        logger.warning("No service found for", serviceKey);
        return;
      }

      box.send(envelope);
    } catch (Throwable t) {
      logger.error(this.getClass(), "Error servicing request", t);
      t.printStackTrace();
    } finally {
      pm.log(getX());
    }
  }

  protected foam.box.Box getServiceBox(CSpec spec) {
    if ( spec == null ) return null;

    if ( ! serviceMap_.containsKey(spec.getName()) ) {
      serviceMap_.put(spec.getName(), createServiceBox(spec));
    }

    return serviceMap_.get(spec.getName());
  }

  protected foam.box.Box createServiceBox(CSpec spec) {
    Logger logger = (Logger)getX().get("logger");

    if ( ! spec.getServe() ) {
      logger.warning(this.getClass(), "Request attempted for disabled service", spec.getName());
      return null;
    }

    try {
      foam.box.Box result = null;
      Class cls = spec.getBoxClass() != null && spec.getBoxClass().length() > 0 ?
        Class.forName(spec.getBoxClass()) :
        DAOSkeleton.class ;
      Skeleton skeleton = (Skeleton) getX().create(cls);
      result = skeleton;

      informService(skeleton, spec);
      skeleton.setDelegateFactory(getX().getFactory(getX(), spec.getName()));

      foam.lang.X x = getX().put(CSpec.class, spec);

      result = new foam.box.SessionServerBox(x, new foam.box.KeepAliveServerBox((foam.box.Box)result), spec.getAuthenticate());

      return result;
    } catch (ClassNotFoundException ex) {
      logger.error(this.getClass(), "Unable to create CSpec servlet: ", spec.getName(), "error: ", ex);
    }

    return null;
  }

  protected void informService(Object service, CSpec spec) {
    if ( service instanceof ContextAware ) ((ContextAware) service).setX(getX());
    if ( service instanceof CSpecAware   ) ((CSpecAware) service).setCSpec(spec);
  }

  @Override
  public void start() {

  }

  @Override
  public X getX() {
    return x_;
  }

  @Override
  public void setX(X x) {
    x_ = x;
  }
}
