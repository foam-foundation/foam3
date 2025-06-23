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
    'com.authy:authy-java:1.1.0',
    'com.google.api-client:google-api-client:1.22.0',
    'com.google.apis:google-api-services-drive:v3-rev72-1.22.0',
    'com.google.apis:google-api-services-sheets:v4-rev567-1.22.0',
    'com.google.oauth-client:google-oauth-client-jetty:1.22.0 -org.mortbay.jetty',
    'com.openhtmltopdf:openhtmltopdf-pdfbox:1.0.10',
    'com.twilio.sdk:twilio:7.50.1',
    'commons-codec:commons-codec:1.18.0',
    'commons-io:commons-io:2.13.0',
    'commons-lang:commons-lang:2.6',
    'commons-net:commons-net:3.6',
    'jakarta.mail:jakarta.mail-api:2.1.2',
    'jakarta.activation:jakarta.activation-api:2.1.2',
    'jakarta.websocket:jakarta.websocket-api:2.0.0',
    'javax.json:javax.json-api:1.1.4',
    'jakarta.json:jakarta.json-api:2.1.3',
    'javax.ws.rs:javax.ws.rs-api:2.1.1',
    'jstl:jstl:1.2',
    'org.apache-extras.beanshell:bsh:2.0b6',
    'org.apache.commons:commons-dbcp2:2.0.1 -xml-apis:xml-apis -xerces:xerces',
    'org.apache.commons:commons-lang3:3.12.0',
    'org.apache.commons:commons-pool2:2.6.2',
    'org.apache.commons:commons-text:1.10.0',
    'org.apache.pdfbox:pdfbox:2.0.27',
    'org.apache.xmlgraphics:batik-codec:1.17',
    'org.apache.xmlgraphics:batik-transcoder:1.17',
    'org.bouncycastle:bcpg-jdk18on:1.76',
    'org.bouncycastle:bcpkix-jdk18on:1.76',
    'org.bouncycastle:bcprov-jdk18on:1.76',
    'org.bouncycastle:bcutil-jdk18on:1.76',
    'org.eclipse.angus:angus-activation:2.0.2',
    'org.eclipse.angus:angus-mail:2.0.3',
    'org.eclipse.angus:imap:2.0.3',
    'org.eclipse.jetty:jetty-proxy:11.0.23',
    'org.eclipse.jetty:jetty-alpn-java-server:11.0.23',
    'org.eclipse.jetty:jetty-http:11.0.23',
    'org.eclipse.jetty:jetty-jmx:11.0.23', // for source build
    'org.eclipse.jetty:jetty-util:11.0.23',
    'org.eclipse.jetty:jetty-util-ajax:11.0.23', // for source build
    'org.eclipse.jetty.http2:http2-server:11.0.23',
    'org.eclipse.jetty.websocket:websocket-jetty-server:11.0.23',
    'org.eclipse.parsson:parsson:1.1.7',
    'org.glassfish:javax.json:1.1.4',
    'org.jsoup:jsoup:1.15.1', // HTML Parser
    'org.jtwig:jtwig-core:5.87.0.RELEASE',
    'org.postgresql:postgresql:42.3.8',
    'nl.martijndwars:web-push:5.1.1', // https://github.com/web-push-libs/webpush-java
    'com.eatthepath:fast-uuid:0.2.0',
    'com.eatthepath:pushy:0.15.4 -io.netty:netty-codec-http2 -io.netty:netty-handler-proxy -io.netty:netty-resolver-dns',
    'io.netty:netty-codec-http2:4.1.114.Final',
    'io.netty:netty-handler-proxy:4.1.114.Final',
    'io.netty:netty-resolver-dns:4.1.114.Final',
    'io.netty:netty-resolver-dns-native-macos:4.1.114.Final',
    'org.junit.jupiter:junit-jupiter-engine:5.6.0',
    'org.junit.jupiter:junit-jupiter-params:5.6.0',
    'org.junit.platform:junit-platform-launcher:1.6.0',
    'org.slf4j:slf4j-api:2.0.16',
    'org.slf4j:slf4j-simple:2.0.16'
  ]
});
