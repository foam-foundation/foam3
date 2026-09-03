/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.app',
  name: 'AppConfig',

  javaImports: [
    'foam.core.theme.Theme',
    'foam.core.theme.Themes',
    'org.eclipse.jetty.server.Request'
  ],

  properties: [
    {
      class: 'String',
      name: 'name'
    },
    {
      class: 'String',
      name: 'pom',
      value: 'pom',
      documentation: 'Name of POM file to provide to foam.js loader (minus .js extension).'
    },
    {
      class: 'String',
      name: 'flags',
      documentation: 'foam flags set in loading script tag',
      // see VirtualHostRoutingServlet
    },
    {
      class: 'String',
      name: 'foamUrl',
      value: '../../../../foam3/src/foam.js',
      documentation: 'Location of FOAM for development build'
    },
    {
      documentation: 'Set at startup in bootscript.',
      class: 'String',
      name: 'version',
      javaSetter: `
      // Explicitly set in bootscript from jar manifest or services.0.
      // Ignore updates from runtime journals.  If updates are not
      // supressed, then on next upgrade the VirtualHostRoutingServlet
      // will craft an index.html with references to a, now, non-existant
      // foam-bin-x.y.z.js file.
      synchronized ( this ) {
        version_ = foam.core.app.AppConfig.class.getPackage().getImplementationVersion();
        if ( foam.util.SafetyUtil.isEmpty(version_) ) {
          version_ = val;
        }
        versionIsSet_ = true;
      }
      `
    },
    {
      class: 'String',
      name: 'privacy',
      value: 'Privacy Policy'
    },
    {
      class: 'String',
      name: 'privacyUrl'
    },
    {
      class: 'String',
      name: 'copyright'
    },
    {
      documentation: 'Set by Theme',
      class: 'String',
      name: 'url',
      value: 'http://localhost:8080'
    },
    {
      class: 'String',
      name: 'urlLabel',
      value: 'FOAM Powered'
    },
    {
      class: 'String',
      name: 'termsAndCondLabel',
      value: 'Terms and Conditions'
    },
    {
      class: 'String',
      name: 'termsAndCondLink'
    },
    {
      class: 'Enum',
      of: 'foam.core.app.Mode',
      name: 'mode'
    },
    {
      class: 'String',
      name: 'appLink',
      documentation: 'Link to Apple App Store for the app',
      visibility: 'HIDDEN'
    },
    {
      class: 'String',
      documentation: 'Link to Google play store for the app, used in LoginView. Configure in themes.jrl for each app per theme.',
      name: 'playLink',
      visibility: 'HIDDEN'
    },
    {
      class: 'String',
      name: 'externalUrl'
    }
  ],

  methods: [
    {
      // A Template method which can be overridden in a sub-class or refined from another
      // package that uses FOAM.
      name: 'configure',
      args: 'Context x, String url',
      type: 'foam.core.app.AppConfig',
      javaCode: `
      return this;
      `
    },
    {
      documentation: `AppConfig is copyied for theme overrides,
only copy properties relevant to the client or to the system when
running under the user's context`,
      name: 'copyFrom',
      args: 'foam.core.app.AppConfig from',
      type: 'foam.core.app.AppConfig',
      javaCode: `
        setPrivacy(from.getPrivacy());
        setPrivacyUrl(from.getPrivacyUrl());
        setCopyright(from.getCopyright());
        setUrl(from.getUrl());
        setUrlLabel(from.getUrlLabel());
        setTermsAndCondLabel(from.getTermsAndCondLabel());
        setTermsAndCondLink(from.getTermsAndCondLink());
        setExternalUrl(from.getExternalUrl());
        return this;
      `,
      code: function(from) {
        this.privacy = from.privacy;
        this.privacyUrl = from.privacyUrl;
        this.copyright = from.copyright;
        this.url = from.url;
        this.urlLabel = from.urlLabel;
        this.termsAndCondLabel = from.termsAndCondLabel;
        this.termsAndCondLink = from.termsAndCondLink;
        this.externalUrl = from.externalUrl;
        return this;
      }
    }
  ]
});
