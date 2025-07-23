package foam.lang;

import foam.core.COREService;

import java.lang.Exception;
import java.util.concurrent.Future;

public class ProxyAgency implements Agency, COREService {
  public Agency delegate_;

  public Agency getDelegate() {
    return delegate_;
  }

  public void setDelegate(Agency delegate) {
    delegate_ = delegate;
  }

  @Override
  public void start() throws Exception {
    if ( delegate_ instanceof COREService service ) {
      service.start();
    }
  }

  @Override
  public void stop() {
    if ( delegate_ instanceof COREService service ) {
      service.stop();
    }
  }

  @Override
  public void reload() {
    if ( delegate_ instanceof COREService service ) {
      service.reload();
    }
  }

  @Override
  public Future<?> submit(X x, ContextAgent agent, String description) {
    return delegate_.submit(x, agent, description);
  }

  @Override
  public void schedule(X x, ContextAgent agent, String key, long delay) {
    delegate_.schedule(x, agent, key, delay);
  }
}
