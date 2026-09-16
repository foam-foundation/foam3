<flow name="HTTPS" category="DOC/DEV" spid="foam"/>
<title>HTTPS</title>
<h1>FOAM SSL/HTTPS</h1>
<b><i>This repo is intended for developer localhost use.</i></b><br/>
It also acts as a working example of configuring a FOAM application for SSL and HTTPS.

<h2>Local development use</h2>
To enable HTTPS during local development:

<code>-a -J../foam-https/deployment/https</code>

On next deployment your application web site will be hosted at

<code>https://localhost:8443</code>

Build WEB_PORT directives are honoured. Specifying <code>-W8100</code>, for example, the site would be hosted at

<code>https://localhost:8100</code>

<h2>Certificates</h2>

The certificates in deployment/https are self-signed and will result in your browser issuing warning about the security of the site. You will have to click through this.

<h3>Certificate Generation</h3>

<b>tools/cert/</b> has scripts to generate a top level CA certificate, wildcard certificates using the CA certificate (self signed), and Java Keystore.

<ul>
<li>create-ca.sh: Generate top level Certificate Authority (CA)</li>
<li>create-wildcard-certificate.sh: Generate wildcard (*) certificate with CA</li>
<li>create-secret-key.sh: Generate a secret key for general encryption and import to keystore</li>
<li>import-cert.sh: Import certificate into keystore</li>
<li>import-secret-key.sh: Import secret key into keystore</li>
<li>import cert-private-key.sh: Import certificate private key info keystore</li>
<li>delete-secret-key: Remove key from keystore</li>
<li>query-secret-key: Determine if keystore contains key</li>
</ul>

<h3>Java KeyStore Generation</h3>
The certificate creation process will also generate a Java <b>keystore</b> to which additional certificates and secret keys can be imported.<br/>
The keystore is referenced in the CSpec for <b>http</b> when <b>https</b> is enabled.<br/>
See <code>deployment/https/services.jrl</code>


<h2>Production Deployment (DevOps)</h2>
<p>In a real production deployment, the FOAM application instances are sitting behind a Load Balancer (LB).  The LB is configured with a certificate from a trusted certificate authority. In an AWS environment, for example, AWS can generate and manage the certificate.</p>
<p>With HTTPS, the HTTPS traffic will terminate at the LB and a new HTTPS connection to the FOAM application will be created.</p>
<p>Traffic to the FOAM application can be either HTTP or HTTPS.</p>
<p>With HTTP, the FOAM application will only use HTTP version 1.</p>
<p>With HTTPS enabled, HTTP version 2 will be used. With HTTPS, the client can still negotiate to use HTTP version 1 if required.</p>
<p>When HTTPS is configured between the LB and the FOAM application, by default, the self-signed FOAM certificate will be used, and the LB must be configured to trust the self-signed certificate.</p>


<h3>TODO</h3>
<ol>
<li>script order</li>
<li>example importing purchased certificate into keystore</li>
</ol>
