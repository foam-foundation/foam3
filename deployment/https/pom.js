foam.POM({
  name:'https',
  help: 'Provide SSL Certificate and port configuration for HTTPS.',
  envs: {
    webPort: '8443'
  },
  copy: [
    { source: 'foamdev-ca.crt' },
    { source: 'foamdev.jks' },
    { source: 'foamdev.pkcs12' }
  ]
});
