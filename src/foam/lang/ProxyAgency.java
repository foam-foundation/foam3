package foam.lang;

import java.util.concurrent.Future;

public class ProxyAgency implements Agency {
  public Agency delegate_;

  public ProxyAgency(Agency delegate) {
    delegate_ = delegate;
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
