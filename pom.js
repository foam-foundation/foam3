/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'foam-full',
  version: 3,
  excludes: [ 'build', 'deployment', 'foam3', 'node_modules', 'doc/templates' ],
  projects: [
    { name: 'src/pom' },
    { name: 'src/foam/core/pom' },
    { name: 'src/foam/core/analytics/mixpanel/pom' },
    { name: 'src/foam/dao/compaction/pom' },
    { name: 'src/foam/net/ipgeo/pom' },
    { name: 'src/foam/u2/wizard/pom' },
    { name: 'src/foam/u2/address/pom' },
    { name: 'src/io/c9/ace/pom' },
    { name: 'webroot/pom' }
  ],
  copy: [
    { source: 'webroot', targetDir: 'webroot' }
  ],
  javaDependencies: [
    'org.json:json:20231013',
    'com.google.api-client:google-api-client:2.9.2',
    'com.google.apis:google-api-services-drive:v3-rev20261011-2.0.0',
    'com.google.apis:google-api-services-sheets:v4-rev20261019-2.9.2',
    'com.google.oauth-client:google-oauth-client:1.39.0',
    'com.google.oauth-client:google-oauth-client-jetty:1.39.0 -org.mortbay.jetty',
    'com.openhtmltopdf:openhtmltopdf-pdfbox:1.0.10',
    'com.twilio.sdk:twilio:13.1.0',
    'com.vladsch.flexmark:flexmark-all:0.64.8',
    'commons-codec:commons-codec:1.18.0',
    'commons-io:commons-io:2.22.0',
    'jakarta.mail:jakarta.mail-api:2.1.2',
    'jakarta.activation:jakarta.activation-api:2.1.2',
    'jakarta.json:jakarta.json-api:2.1.3',
    'javax.ws.rs:javax.ws.rs-api:2.1.1',
    'org.apache-extras.beanshell:bsh:2.0b6',
    'org.apache.commons:commons-lang3:3.21.0',
    'org.apache.commons:commons-text:1.10.0',
    'org.apache.pdfbox:pdfbox:2.0.37',
    'org.apache.xmlgraphics:batik-codec:1.20',
    'org.apache.xmlgraphics:batik-transcoder:1.20',
    'org.bouncycastle:bcpg-jdk18on:1.86',
    'org.bouncycastle:bcpkix-jdk18on:1.86',
    'org.bouncycastle:bcprov-jdk18on:1.86',
    'org.bouncycastle:bcutil-jdk18on:1.86',
    'org.eclipse.angus:angus-activation:2.0.2',
    'org.eclipse.angus:angus-mail:2.0.3',
    'org.eclipse.angus:imap:2.0.3',
    'org.eclipse.jetty:jetty-server:12.1.14',
    'org.eclipse.jetty:jetty-alpn-java-server:12.1.14',
    'org.eclipse.jetty:jetty-http:12.1.14',
    'org.eclipse.jetty:jetty-jmx:12.1.14', // for source build
    'org.eclipse.jetty:jetty-util:12.1.14',
    'org.eclipse.jetty:jetty-util-ajax:12.1.14', // for source build
    'org.eclipse.jetty.compression:jetty-compression-server:12.1.14',
    'org.eclipse.jetty.compression:jetty-compression-gzip:12.1.14',
    'org.eclipse.jetty.ee11:jetty-ee11-proxy:12.1.14',
    'org.eclipse.jetty.ee11:jetty-ee11-servlet:12.1.14',
    'org.eclipse.jetty.ee11.websocket:jetty-ee11-websocket-jetty-server:12.1.14',
    'org.eclipse.jetty.http2:jetty-http2-server:12.1.14',
    'org.eclipse.parsson:parsson:1.1.7',
    'org.jsoup:jsoup:1.23.2', // HTML Parser
    'nl.martijndwars:web-push:5.1.1 -org.asynchttpclient:async-http-client -org.bitbucket.b_c:jose4j', // https://github.com/web-push-libs/webpush-java
    'org.asynchttpclient:async-http-client:2.15.0 -io.netty', // its netty modules come from the pinned versions below
    'org.bitbucket.b_c:jose4j:0.9.6',
    'com.eatthepath:fast-uuid:0.2.0',
    'com.eatthepath:pushy:0.15.4 -io.netty:netty-codec-http2 -io.netty:netty-handler-proxy -io.netty:netty-resolver-dns',
    'io.netty:netty-codec:4.1.136.Final',
    'io.netty:netty-codec-socks:4.1.136.Final',
    'io.netty:netty-codec-http:4.1.136.Final',
    'io.netty:netty-codec-http2:4.1.136.Final',
    'io.netty:netty-handler:4.1.136.Final',
    'io.netty:netty-handler-proxy:4.1.136.Final',
    'io.netty:netty-resolver-dns:4.1.136.Final',
    'io.netty:netty-resolver-dns-native-macos:4.1.136.Final',
    'org.slf4j:slf4j-api:2.0.16',
    'org.slf4j:slf4j-simple:2.0.16'
  ]
});
