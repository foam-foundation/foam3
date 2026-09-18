<flow name="HTTPS" category="DOC/DEV" spid="foam" label="HTTPS" description="Configuring a FOAM application for SSL/HTTPS in local development and production, including certificate generation." keywords="https,ssl,certificates,keystore,deployment"/>

# FOAM SSL/HTTPS

***This repo is intended for developer localhost use.*****It also acts as a working example of configuring a FOAM application for SSL and HTTPS.

## Local development use

To enable HTTPS during local development:

`-a -J../foam-https/deployment/https`

On next deployment your application web site will be hosted at

`https://localhost:8443`

Build WEB_PORT directives are honoured. Specifying `-W8100`, for example, the site would be hosted at

`https://localhost:8100`

## Certificates

The certificates in deployment/https are self-signed and will result in your browser issuing warning about the security of the site. You will have to click through this.

### Certificate Generation

<b>tools/cert/** has scripts to generate a top level CA certificate, wildcard certificates using the CA certificate (self signed), and Java Keystore.

- create-ca.sh: Generate top level Certificate Authority (CA)
- create-wildcard-certificate.sh: Generate wildcard (*) certificate with CA
- create-secret-key.sh: Generate a secret key for general encryption and import to keystore
- import-cert.sh: Import certificate into keystore
- import-secret-key.sh: Import secret key into keystore
- import cert-private-key.sh: Import certificate private key info keystore
- delete-secret-key: Remove key from keystore
- query-secret-key: Determine if keystore contains key

### Java KeyStore Generation

The certificate creation process will also generate a Java **keystore** to which additional certificates and secret keys can be imported.**The keystore is referenced in the CSpec for <b>http** when **https** is enabled.

See `deployment/https/services.jrl`

## Production Deployment (DevOps)

In a real production deployment, the FOAM application instances are sitting behind a Load Balancer (LB).  The LB is configured with a certificate from a trusted certificate authority. In an AWS environment, for example, AWS can generate and manage the certificate.

With HTTPS, the HTTPS traffic will terminate at the LB and a new HTTPS connection to the FOAM application will be created.

Traffic to the FOAM application can be either HTTP or HTTPS.

With HTTP, the FOAM application will only use HTTP version 1.

With HTTPS enabled, HTTP version 2 will be used. With HTTPS, the client can still negotiate to use HTTP version 1 if required.

When HTTPS is configured between the LB and the FOAM application, by default, the self-signed FOAM certificate will be used, and the LB must be configured to trust the self-signed certificate.

### TODO

1. script order
2. example importing purchased certificate into keystore
