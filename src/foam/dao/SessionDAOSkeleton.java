/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.dao;

import foam.box.RPCMessage;
import foam.lang.FObject;

/**
 * Extend the generated DAOSkeleton and map all non Context-Oriented methods
 * to their Context-Oriented equivalents. Ex.: from put() to put_().
 * This is so that the user's session is propogated to DAO calls.
 **/
public class SessionDAOSkeleton
  extends DAOSkeleton
{

  public void send(foam.box.Envelope envelope) {
    if ( ! ( envelope.getMessage() instanceof foam.box.RPCMessage) ) {
      // TODO return an error?
      return;
    }

    RPCMessage rpc = (RPCMessage) envelope.getMessage();
    String     n   = rpc.getName();

         if ( "put".equals(n)       ) { rpc.setName("put_"); }
    else if ( "remove".equals(n)    ) { rpc.setName("remove_"); }
    else if ( "find".equals(n)      ) { rpc.setName("find_"); }
    else if ( "select".equals(n)    ) { rpc.setName("select_"); }
    else if ( "removeAll".equals(n) ) { rpc.setName("removeAll_"); }
    else if ( "listen".equals(n)    ) { rpc.setName("listen_"); }
    else if ( "pipe".equals(n)      ) { rpc.setName("pipe_"); }
    else if ( "cmd".equals(n)       ) { rpc.setName("cmd_"); }

    RemoteListeners listeners = (RemoteListeners) envelope.getX().get("remoteListeners");
    if ( listeners != null ) {
      // After the renames above, so both spellings (cmd, cmd_) are caught.
      if ( "cmd_".equals(rpc.getName()) && stopListening(listeners, rpc, envelope) ) return;
      if ( "listen_".equals(rpc.getName()) ) trackListen(listeners, rpc);
    }

    if ( "put_".equals(n) ) {
      DAO delegate = (DAO) getDelegateFactory().create(envelope.getX());

      synchronized ( this ) {
        FObject obj = (foam.lang.FObject)(rpc.getArgs() != null && rpc.getArgs().length > 1 ? rpc.getArgs()[1] : null);
        if ( ! delegate.getOf().isInstance(obj) )
          throw new ClassCastException(obj.getClass() + " isn't instance of " + delegate.getOf());
        if ( obj != null ) {
          FObject oldObj = delegate.find(obj);
          if ( oldObj != null ) {
            rpc.getArgs()[1] = oldObj.fclone().copyFrom(obj);
          }
        }
      }
    }

    super.send(envelope);
  }


  /** A stop from the client: stop that listener and answer here. The DAO never sees it. */
  protected boolean stopListening(RemoteListeners listeners, RPCMessage rpc, foam.box.Envelope envelope) {
    Object[] args = rpc.getArgs();
    if ( args == null ) return false;
    for ( Object a : args ) {
      if ( a instanceof StopListeningCmd ) {
        listeners.stop(((StopListeningCmd) a).getName());
        if ( envelope.getReplyBox() != null ) {
          envelope.getReplyBox().send(new foam.box.Envelope(getX().create(foam.box.RPCReturnMessage.class), null));
        }
        return true;
      }
    }
    return false;
  }

  /** A listen from the client: remember it by its SubBox name, so it can be stopped. */
  protected void trackListen(RemoteListeners listeners, RPCMessage rpc) {
    Object[] args = rpc.getArgs();
    if ( args == null || args.length < 2 || ! ( args[1] instanceof ClientSink ) ) return;
    foam.box.Box box = ((ClientSink) args[1]).getDelegate();
    if ( ! ( box instanceof foam.box.SubBox ) ) return;
    args[1] = listeners.track(((foam.box.SubBox) box).getName(), (Sink) args[1]);
  }
}
