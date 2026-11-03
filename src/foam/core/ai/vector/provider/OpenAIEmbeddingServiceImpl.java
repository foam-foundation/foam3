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

public class OpenAIEmbeddingServiceImpl extends OpenAIEmbeddingService {

  public OpenAIEmbeddingServiceImpl(X x) { setX(x); }

  @Override
  public VectorEmbedding embed(X x, String text) {
    return embedAll(x, new String[] { text })[0];
  }

  @Override
  public VectorEmbedding[] embedAll(X x, String[] texts) {
    try {
      JSONArray input = new JSONArray();
      for ( String t : texts ) input.put(t);

      String body = new JSONObject()
        .put("model", getModel())
        .put("input", input)
        .toString();

      var req = HttpRequest.newBuilder()
        .uri(URI.create(getEndpoint()))
        .header("Content-Type",  "application/json")
        .header("Authorization", "Bearer " + getApiKey())
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();

      var resp = HttpClient.newHttpClient()
        .send(req, HttpResponse.BodyHandlers.ofString());

      if ( resp.statusCode() != 200 )
        throw new RuntimeException("OpenAI returned HTTP " + resp.statusCode() + ": " + resp.body());

      JSONArray data = new JSONObject(resp.body()).getJSONArray("data");
      VectorEmbedding[] results = new VectorEmbedding[data.length()];
      for ( int i = 0; i < data.length(); i++ ) {
        JSONObject item = data.getJSONObject(i);
        int idx         = item.getInt("index");
        JSONArray emb   = item.getJSONArray("embedding");
        float[] v       = new float[emb.length()];
        for ( int j = 0; j < emb.length(); j++ ) v[j] = (float) emb.getDouble(j);
        results[idx] = new VectorEmbedding.Builder(x)
          .setText(texts[idx])
          .setEmbeddingModel(getModel())
          .setVector(v)
          .build();
      }
      return results;
    } catch ( RuntimeException e ) {
      throw e;
    } catch ( Exception e ) {
      throw new RuntimeException("OpenAI embed failed", e);
    }
  }
}
