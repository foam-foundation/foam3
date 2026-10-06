/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.ai.vector.provider;

import foam.ai.vector.VectorEmbedding;
import foam.lang.X;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.json.JSONArray;
import org.json.JSONObject;

public class OllamaEmbeddingServiceImpl extends OllamaEmbeddingService {

  public OllamaEmbeddingServiceImpl(X x) { setX(x); }

  @Override
  public VectorEmbedding embed(X x, String text) {
    try {
      String body = new JSONObject()
        .put("model",  getModel())
        .put("prompt", text)
        .toString();
      var req = HttpRequest.newBuilder()
        .uri(URI.create(getEndpoint()))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();
      var resp = HttpClient.newHttpClient()
        .send(req, HttpResponse.BodyHandlers.ofString());
      if ( resp.statusCode() != 200 ) {
        throw new RuntimeException("Ollama returned HTTP " + resp.statusCode() + ": " + resp.body());
      }
      JSONArray arr = new JSONObject(resp.body()).getJSONArray("embedding");
      float[] v = new float[arr.length()];
      for ( int i = 0; i < arr.length(); i++ ) v[i] = (float) arr.getDouble(i);
      return new VectorEmbedding.Builder(x)
        .setText(text)
        .setEmbeddingModel(getModel())
        .setVector(v)
        .build();
    } catch ( RuntimeException e ) {
      throw e;
    } catch ( Exception e ) {
      throw new RuntimeException("Ollama embed failed", e);
    }
  }

  @Override
  public VectorEmbedding[] embedAll(X x, String[] texts) {
    VectorEmbedding[] results = new VectorEmbedding[texts.length];
    for ( int i = 0; i < texts.length; i++ ) results[i] = embed(x, texts[i]);
    return results;
  }
}
