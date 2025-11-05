/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.box.socket;

import foam.box.Box;
import foam.box.Envelope;
import foam.box.socket.SocketRouter;
import foam.lang.ContextAgent;
import foam.lang.ContextAware;
import foam.lang.X;
import foam.lang.XLocator;
import foam.lib.json.JSONParser;
import foam.core.logger.PrefixLogger;
import foam.core.logger.Logger;
import foam.core.pm.PM;
import foam.core.om.OMLogger;

import java.net.ServerSocket;
import java.net.Socket;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.EOFException;
import java.io.InputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

public class SocketServerProcessor
  extends Thread
  implements ContextAware, ContextAgent
{
  protected X x_;
  protected Socket socket_;
  protected SocketRouter socketRouter_;
  protected DataInputStream in_;
  protected DataOutputStream out_;
  protected Logger logger_;

  /**
   * Decode the socket request stream, and pass to a SocketRouter.
   */
  public SocketServerProcessor(X x, Socket socket)
    throws IOException
  {
    setX(x);
    setDaemon(true);
    socket_ = socket;
    in_ = new DataInputStream(new BufferedInputStream(socket.getInputStream()));
    out_ = new DataOutputStream(new BufferedOutputStream(socket.getOutputStream()));
    logger_ = new PrefixLogger(new Object[] {
        this.getClass().getSimpleName(),
        socket.getRemoteSocketAddress()
      }, (Logger) getX().get("logger"));

    X y = getX()
      .put("socketInputStream", in_)
      .put("socketOutputStream", out_)
      .put("socket", socket_);

    socketRouter_ = new SocketRouter(y);
  }

  @Override
  public X getX() {
    return x_;
  }

  @Override
  public void setX(X x) {
    x_ = x;
  }

  protected byte [] readBytes (InputStream in, int expectedSize)
    throws IOException {
    final byte[] buffer = new byte[expectedSize];
    int totalReadSize = 0;
    while (totalReadSize < expectedSize) {
      int readSize = in.read(buffer, totalReadSize, expectedSize - totalReadSize);
      if (readSize < 0) throw new EOFException ();
      totalReadSize += readSize;
    }
    return buffer;
  }

  public void execute(X x) {
    String pmKey = "SocketServerProcessor";
    String pmName = String.valueOf(socket_.getRemoteSocketAddress());
    OMLogger omLogger = (OMLogger) x.get("OMLogger");
    try {
      while ( true ) {
        PM pm = null;
        try {
          omLogger.log(pmKey, pmName, "execute:parse");
          pm = PM.create(x, pmKey, pmName, "execute:parse");

          int length = in_.readInt();
          byte[] bytes = readBytes(in_, length);
          String data = new String(bytes, 0, length, StandardCharsets.UTF_8);
          XLocator.set(getX());
          Envelope envelope = (Envelope) x.create(JSONParser.class).parseString(data);
          if ( envelope == null ) {
            throw new IllegalArgumentException("Failed to parse. from: "+socket_.getRemoteSocketAddress()+", message: "+data);
          }
          pm.log(x);

          // NOTE: enable along with send and receive debug calls in SocketConnectionBox to monitor all messages.
          // SocketClientReplyBox replyBox = (SocketClientReplyBox) envelope.getReplyBox()
          // String replyId = replyBox != null ? replyBox.getReplyBoxId() : "na";
          // logger_.debug("receive", "replyBoxId", replyId, (String) ((foam.box.SubBoxMessage)envelope.getMessage()).getName());

          socketRouter_.service(envelope);
        } catch ( java.net.SocketTimeoutException e ) {
          continue;
        } catch ( java.io.IOException e ) {
          logger_.debug(e.getMessage());
          break;
        } catch ( Throwable t ) {
          // logger_.error(t);
          if ( pm != null ) pm.error(x, t);
          try {
            // TODO: abstract this into a SocketWriter as it's duplicated in SocketConnectionBox.js
            foam.box.RemoteException remote = new foam.box.RemoteException();
            remote.setId(t.getClass().getName());
            remote.setMessage(t.getMessage());
            if ( t instanceof foam.lang.FOAMException ) {
              remote.setException((foam.lang.FOAMException) t);
              remote.setRetryable(((foam.lang.FOAMException) t).getRetryable());
            }
            foam.box.RPCErrorMessage error = new foam.box.RPCErrorMessage();
            error.setData(remote);
            foam.box.Envelope reply = new foam.box.Envelope();
            reply.setMessage(error);

            foam.lib.formatter.JSONFObjectFormatter formatter = new foam.lib.formatter.JSONFObjectFormatter();
            formatter.setX(x);
            formatter.output(reply);
            String replyString = formatter.builder().toString();
            byte[] replyBytes = replyString.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            synchronized ( out_ ) {
              out_.writeInt(replyBytes.length);
              out_.write(replyBytes);
              out_.flush();
            }
            logger_.error("Reply with error.", t);
          } catch ( Throwable th ) {
            logger_.error("Failed to reply with error.", t, th);
          }
          break;
        } finally {
          XLocator.set(null);
        }
      }
    } finally {
      try {
        if ( socket_ != null ) {
          logger_.debug("socket,close");
          socket_.close();
        }
      } catch ( java.io.IOException e ) {
        // nop
      }
    }
  }
}
