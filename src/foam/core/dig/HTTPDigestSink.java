/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.dig;

import static foam.mlang.MLang.EQ;

import java.io.BufferedWriter;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.SocketException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.security.MessageDigest;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import foam.lang.Detachable;
import foam.lang.FObject;
import foam.lang.X;
import foam.dao.AbstractSink;
import foam.dao.DAO;
import foam.dao.HTTPSink;
import foam.lib.NetworkPropertyPredicate;
import foam.lib.Outputter;
import foam.lib.PropertyPredicate;
import foam.lib.json.OutputterMode;
import foam.log.LogLevel;
import foam.core.alarming.Alarm;
import foam.core.http.Format;
import foam.core.logger.Logger;
import foam.util.SafetyUtil;

public class HTTPDigestSink extends HTTPSink {

  protected DUGDigestConfig dugDigestConfig_;
  protected boolean removeWhitespacesInPayloadDigest_;

  private static final ThreadLocal<Outputter> outputter = new ThreadLocal<>();

  public HTTPDigestSink(String url, Format format) {
    this(url, "", null, format, null, false, false);
  }

  public HTTPDigestSink(String url, String bearerToken, DUGDigestConfig dugDigestConfig, Format format, PropertyPredicate propertyPredicate, boolean outputDefaultValues, boolean removeWhitespacesInPayloadDigest) {
    url_ = url;
    bearerToken_ = bearerToken;
    dugDigestConfig_ = dugDigestConfig;
    format_ = format;
    propertyPredicate_ = propertyPredicate;
    outputDefaultValues_ = outputDefaultValues;
    removeWhitespacesInPayloadDigest_ = removeWhitespacesInPayloadDigest;
  }

  @Override
  public void put(Object obj, Detachable sub) {
    FObject fobj = (FObject) obj;
    Object id = fobj.getProperty("id");
    String className = fobj.getClass().getSimpleName();
    int responseCode = -1;
    int retryCount = 3;

    while ( retryCount > 0 ) {
      try {
        responseCode = sendRequest(fobj);

        // resend on 4xx and 5xx
        if ( responseCode >= 400 && responseCode <= 599 )  {

          try {
            Thread.sleep(5000);
          } catch (InterruptedException e) {}

          retryCount--;
        } else {
          return;
        }
      } catch (SocketException e) {
        // create an alarm on connection timeout
        String name = "HTTP DIGEST CONNECTION TIMEOUT";
        String note = "[" + className + ", " + id + ", " + new Date() + "]";
        createAlarm(name, note, LogLevel.ERROR);

        throw new RuntimeException(e);
      } catch (Throwable t) {
        String name = "HTTP DIGEST UNEXPECTED FAILURE";
        String note = "[" + className + ", " + id + ", " + new Date() + "]";
        createAlarm(name, note, LogLevel.ERROR);

        throw new RuntimeException(t);
      }
    }

    // failed to send successfully
    String name = "HTTP DIGEST " + responseCode + " RESPONSE";
    String note = "[" + className + ", " + id + ", " + new Date() + "]";
    createAlarm(name, note, LogLevel.ERROR);

    throw new RuntimeException(this.getClass().getSimpleName() + "[" + className + ", " + id + ", " + responseCode + "]");
  }

  private int sendRequest(Object obj) throws Exception {
    HttpURLConnection conn = null;
    try {
      conn = (HttpURLConnection) new URL(url_).openConnection();
      conn.setRequestMethod("POST");
      if ( ! SafetyUtil.isEmpty(bearerToken_) ) {
        conn.setRequestProperty("Authorization", "Bearer " + bearerToken_);
      }

      conn.setDoInput(true);
      conn.setDoOutput(true);
      if ( format_ == Format.JSON ) {
        outputter.set(
          propertyPredicate_ == null ?
            new foam.lib.json.Outputter(getX()).setOutputDefaultValues(outputDefaultValues_).setPropertyPredicate(new NetworkPropertyPredicate()) :
            new foam.lib.json.Outputter(getX()).setOutputDefaultValues(outputDefaultValues_).setPropertyPredicate(propertyPredicate_)
        );
        conn.addRequestProperty("Accept", "application/json");
        conn.addRequestProperty("Content-Type", "application/json");
      } else if ( format_ == Format.XML ) {
        outputter.set(new foam.lib.xml.Outputter(getX(), OutputterMode.NETWORK));
        conn.addRequestProperty("Accept", "application/xml");
        conn.addRequestProperty("Content-Type", "application/xml");
      } else {
        throw new RuntimeException(this.getClass().getSimpleName() + ", Unsupported content format");
      }
      // override default user-agent (eg. Java/11.0.19) to prevent exposing the backend tech stack
      conn.addRequestProperty("User-Agent", "Mozilla/5.0");

      // add hashed payload-digest to request headers
      FObject fobj = (FObject) obj;
      String payload = outputter.get().stringify(fobj);
      String digest = getDigest(getX(), dugDigestConfig_, payload);
      conn.addRequestProperty("payload-digest", digest);

      setCustomConnectionProperties(fobj, conn);
      conn.connect();

      try (OutputStream os = conn.getOutputStream()) {
        try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(os, StandardCharsets.UTF_8))) {
          writer.write(payload);
          writer.flush();
        }
      }
      ((Logger) getX().get("logger")).debug(this.getClass().getSimpleName(), "Sent DUG webhook with digest", url_, payload, digest, "Status code: " + conn.getResponseCode());

      return conn.getResponseCode();
    } finally {
      if ( conn != null ) {
        conn.disconnect();
      }
    }
  }

  public void createAlarm(String name, String note, LogLevel severity) {
    DAO alarmDAO = (DAO) getX().get("alarmDAO");
    Alarm alarm = (Alarm) alarmDAO.find(EQ(Alarm.NAME, name));
    if ( alarm == null ) {
      alarm = new Alarm.Builder(getX())
        .setName(name)
        .setSeverity(severity)
        .setNote(note)
        .build();
    } else {
      alarm = (Alarm) alarm.fclone();
      alarm.setNote(alarm.getNote() + "\n" + note);
    }
    alarmDAO.put(alarm);
  }

  protected String byte2Hex(byte[] bytes) {
    StringBuffer stringBuffer = new StringBuffer();
    String temp = null;
    for ( int i=0; i<bytes.length; i++ ) {
      temp = Integer.toHexString(bytes[i] & 0xFF);
      if ( temp.length() == 1 ) {
        stringBuffer.append("0");
      }
      stringBuffer.append(temp);
    }
    return stringBuffer.toString();
  }

  protected String getDigest(X x, DUGDigestConfig config, String payload)
    throws Exception {
    try {
      if (removeWhitespacesInPayloadDigest_)
        payload = payload.replaceAll("\\s", "");

      if ( config.getAlgorithm().toLowerCase().startsWith("hmac") ) {
        // Generate HMAC Digest
        // @see https://commons.apache.org/proper/commons-codec/apidocs/src-html/org/apache/commons/codec/digest/HmacUtils.html
        // @see https://sorenpoulsen.com/calculate-hmac-sha256-with-java
        Mac mac = Mac.getInstance(config.getAlgorithm()); // "HmacSHA256"
        SecretKeySpec secretKeySpec = new SecretKeySpec(config.getSecretKey().getBytes(StandardCharsets.UTF_8), config.getAlgorithm());
        mac.init(secretKeySpec);
        byte[] digest = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        return byte2Hex(digest);
      }

      MessageDigest md = MessageDigest.getInstance(config.getAlgorithm());
      md.update(config.getSecretKey().getBytes(StandardCharsets.UTF_8));
      md.update(payload.getBytes(StandardCharsets.UTF_8));
      return byte2Hex(md.digest());
    } catch (Exception e) {
      ((Logger) x.get("logger")).error(this.getClass().getSimpleName(), "Failed digest calculation", config.getAlgorithm(), e.getMessage());
      throw e;
    }
  }

  protected void setCustomConnectionProperties(FObject fobj, HttpURLConnection conn) {}
}
