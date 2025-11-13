/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.client',
  name: 'ClientBuilder',

  implements: [
    'foam.mlang.Expressions'
  ],

  requires: [
    'foam.box.HTTPBox',
    'foam.box.RetryBox',
    'foam.box.SessionClientBox',
    'foam.dao.EasyDAO',
    'foam.dao.RequestResponseClientDAO',
    'foam.core.app.ClientAppConfigService',
    'foam.core.boot.CSpec',
    'foam.core.crunch.box.CrunchClientBox',
    'foam.core.auth.Subject'
  ],

  imports: [ 'error', 'params', 'window' ],

  exports: [ 'sessionID' ],

  properties: [
    {
      class: 'String',
      name: 'sessionName',
      value: 'defaultSession'
    },
    {
      name: 'sessionID',
      factory: function() {
        var urlSession = this.params.sessionId || localStorage[this.sessionName];

        if ( ! urlSession ) {
          urlSession = ( localStorage[this.sessionName] = foam.uuid.randomGUID() + this.window.location.search );
        }

        return urlSession;
      }
    },
    {
      class: 'FObjectArray',
      of: 'foam.core.boot.CSpec',
      name: 'extraServices'
    },
    {
      class: 'Boolean',
      name: 'authenticate',
      value: true
    },
    {
      name: 'clientBuilderService',
      factory: function() {
        // The client completely fails if cSpecDAO fails to load, so infinitely retry
        // requests to cSpecDAO.
        return foam.core.client.ClientClientBuilderService.create({
          delegate: this.SessionClientBox.create({
            delegate: this.RetryBox.create({
              maxAttempts: -1,
              delegate: this.HTTPBox.create({
                method: 'POST',
                url: 'service/clientBuilderService'
              })
            })
          })
        }, this);
      }
    },
    {
      name: 'promise',
      factory: function() {
        /* ignoreWarning */
        var self = this;
        return new Promise(async function(resolve) {
          // TODO: Instead of generating a model, generate and return a context.
          // We're not currently doing this because building a model with
          // properties that have factories allow those properties to get
          // instantiated lazily but there's no reason we can't give contexts
          // the ability to do this too.
          var client = {
            package:    'foam.core.client',
            name:       'Client',
            imports:    ['params', 'window'],
            exports:    ['as client', 'theme',  'sessionID'],
            constants:  { eagerClients: [] },
            properties: [
              {
                __copyFrom__: 'foam.core.client.ClientBuilder.SESSION_NAME',
              },
              {
                __copyFrom__: 'foam.core.client.ClientBuilder.SESSION_ID',
              },
              {
                class: 'foam.lang.FObjectProperty',
                of: 'foam.core.auth.Subject',
                name: 'initSubject',
                description: 'subject that was used to create the client',
                final: true,
                adapt: function(_, n) {
                  // Recreate Subject in the correct context
                  return n?.clone(this);
                }
              },
              {
                class: 'foam.lang.FObjectProperty',
                of: 'foam.core.theme.Theme',
                name: 'theme',
                description: 'theme that was used to create the client',
                adapt: function(_, n) {
                  return n?.clone(this);
                }
              }
            ],
            methods: [
              function init() {
                // Wake up any eager clients
                this.EAGER_CLIENTS.forEach(c => this[c]);
              }
            ]
          };

          // var references = [];

          let nspec = foam.core.boot.CSpec;

          // console.time('clientBuild');
          /*
            We can bundle these into a single call but bundling hurts performance marginally:
            Results as of last run(ms) on 2024/08/13 (Throttle using mid-tier mobile preset, Chrome dev tools):
              Bundle:
                Throttled: 808, 764, 786, 750, 767
                Not Throttled: 89, 66, 70, 63, 71

              Unbundled:
                Throttled: 776, 792,793,782,783
                Not Throttled: 52, 51, 53, 52, 56
          */
          let subjectPromise = self.clientBuilderService.getSubject();
          let themePromise   = self.clientBuilderService.getTheme();
          let cSpecsPromise  = self.clientBuilderService.getClient(this, self.PROJECTION(nspec.NAME, nspec.CLIENT, nspec.LAZY_CLIENT));

          // Force hard reload when app version updates
          var appConfigPromise = self.clientBuilderService.getAppConfig(this).then(function(appConfig) {
            client.exports.push('appConfig');
            // references = references.concat(foam.json.references(self.__context__, appConfig));
            client.properties.push({
              name: 'appConfig',
              factory: function() {
                return appConfig.clone(this.__subContext__);
              }
            });

            var version = appConfig.version;
            if ( 'CLIENT_VERSION' in localStorage ) {
              var oldVersion = localStorage.CLIENT_VERSION;
              if ( version != oldVersion ) {
                localStorage.CLIENT_VERSION = version;
                location.reload(true);
              }
            } else {
              localStorage.CLIENT_VERSION = version;
            }
          });

          await cSpecsPromise.then(async p => {
            await foam.dao.ArrayDAO.create({array: p.array.concat(self.extraServices)})
              .select({
                put: function(spec) {
                  if ( spec.client ) {
                    var serviceName = spec.name.substring(spec.name.lastIndexOf('.') + 1);
                    client.exports.push(serviceName);

                    var json;
                    try {
                      json = JSON.parse(spec.client);
                    } catch (err) {
                      self.error('invalid nspec.client', spec.client, err);
                    }

                    if ( ! spec.lazyClient )
                      client.constants.eagerClients.push(spec.name);

                    //references = references.concat(foam.json.references(self.__context__, json));

                    client.properties.push({
                      name: spec.name,
                      factory: function() {
                        if ( ! json.class ) json.class = 'foam.dao.EasyDAO';
                        var cls = foam.lookup(json.class);
                        if ( cls == null ) {
                          self.error('Uknown Client class:', json.class, 'for service:', spec.name);
                          return null;
                        }
                        var defaults = {
                          serviceName: 'service/' + spec.name
                        };
                        if ( cls === foam.dao.EasyDAO ) {
                          defaults.cache              = true;
                          defaults.ttlSelectPurgeTime = 15000;    // for select()
                          defaults.ttlPurgeTime       = 15000;    // for find()
                          defaults.daoType            = 'CLIENT';
                        }
                        for ( var k in defaults ) {
                          if ( cls.getAxiomByName(k) && json[k] == undefined )
                            json[k] = defaults[k];
                        }
                        return foam.json.parse(json, null, this.__subContext__);
                      }
                    });
                  }
                },
                eof: function() {
                  // disable class-loading
                  /*Promise.allSettled(references.concat(appConfigPromise))*/
                  Promise.all([appConfigPromise, subjectPromise, themePromise]).then(async function([appConfig, subject, theme]) {
                    client = foam.lang.Model.create(client).buildClass();
                    client = client.create({
                      theme: theme,
                      initSubject: subject || self.Subject.create({}),
                      sessionID: self.sessionID
                    }, self.__context__);
                    client.EAGER_CLIENTS.forEach(c => {
                      client.__subContext__[c];
                    });
                    // console.timeEnd('clientBuild');
                    // Preload menuDAO, remove when we have pre-cached daos from the server
                    client.menuDAO.select();

                    resolve(client);
                  });
                }
              });
          });
        });
      }
    }
  ],

  methods: [
    function init() {
      // Wake up and find/create a sessionID for building the client
      this.sessionID;
    }
  ]
});
