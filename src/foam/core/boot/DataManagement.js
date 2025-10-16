/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.boot',
  name: 'DataManagement',
  extends: 'foam.u2.Controller',

  mixins: ['foam.u2.Router'],

  documentation: 'Data Management UI for browsing all DAOs.',

  classes: [
    {
      name: 'DAOView',
      extends: 'foam.u2.Controller',

      requires: [
        'foam.comics.BrowserView',
        'foam.comics.v2.DAOBrowseControllerView',
        'foam.u2.view.AltView'
      ],

      messages: [
        { name: 'CONTROLLER1', message: 'Controller 1' },
        { name: 'CONTROLLER2', message: 'Controller 3' }
      ],

      properties: [
        'data'
      ],

      methods: [
        function render() {
          this
          .tag(this.AltView, {
            data$: this.data$,
            views: [
              [
                { class: this.BrowserView },
                this.CONTROLLER1
              ],
              [
                { class: foam.comics.v3.DAOController, showNav: false },
                this.CONTROLLER2
              ]
            ],
              selectedView: this.CONTROLLER2
          });
        }
      ]
    },
    {
      name: 'DAOListView',
      extends: 'foam.u2.Controller',

      mixins: [ 'foam.u2.memento.Memorable' ],

      imports: [ 'cSpecDAO', 'route', 'stack' ],

      css: `
        ^dao, ^header {
          display: inline-block;
          font-size: smaller;
          margin: 2px;
          padding: 2px;
          width: 220px;
        }
        ^dao {
          color: $textTertiary;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        ^dao:hover {
          background: $backgroundSecondary;
        }
        ^section {
          display: inline-grid;
          vertical-align: baseline;
        }
        ^header {
          background: $backgroundInverse;
          color:$textOnInverse;
          font-weight: $font-bold;
        }
        ^footer {
          color: $textTertiary;
          padding-top: 12px;
        }
      `,

      properties: [
        {
          name: 'data',
          factory: function() {
           return this.cSpecDAO;
          }
        },
        {
          class: 'Int',
          name: 'daoCount'
        },
        {
          class: 'Int',
          name: 'totalDAOCount'
        },
        {
          name: 'filteredDAO',
          factory: function() {
           var dao = this.data.where(
             this.AND(
               this.CONTAINS(foam.core.boot.CSpec.ID, 'DAO'),
               this.EQ(foam.core.boot.CSpec.SERVE,     true)
             ));

           /* ignoreWarning */
           dao.select(this.COUNT()).then(c => this.totalDAOCount = this.daoCount = c.value);

           return dao;
          }
        },
        {
          class: 'String',
          name: 'search',
          view: {
           class: 'foam.u2.SearchField',
           onKey: true
          },
          memorable: true,
          preSet: function(o, n) { this.daoCount = 0; return n; }
        }
      ],

      methods: [
        function render() {
          this.SUPER();

          var self          = this;
          var currentLetter = '';
          var section;
          this.stack.setTitle('Data Management', this);
          this.onDetach(this.stack.setTrailingContainer(this.E().start(this.SEARCH).focus().end()));
          this.addClass();
          var updateSections = [];
          var i = 0;

          this.filteredDAO.select().then(function(specs) {
            specs.array.sort(function(o1, o2) { return foam.String.compare(o1.id.toUpperCase(), o2.id.toUpperCase())}).forEach(function(spec) {
              var label = foam.String.capitalize(spec.id.substring(0, spec.id.length-3));
              var l     = label.charAt(0);

              if ( l != currentLetter ) {
                let lSection;
                let showSection = foam.lang.SimpleSlot.create({value: true});
                i = updateSections.length;

                var updateSlot = foam.lang.SimpleSlot.create({value: false});
                updateSections.push(updateSlot);

                updateSections[i].sub(function() {
                  // first child is a header
                  for ( var j = 1 ; j < lSection.childNodes.length ; j++ ) {
                    if ( lSection.childNodes[j].shown ) {
                      showSection.set(true);
                      return;
                    }
                  }
                  showSection.set(false);
                });

                currentLetter = l;

                section = self.start('span')
                  .show(showSection)
                  .addClass(self.myClass('section'))
                  .start('span')
                    .addClass(self.myClass('header'))
                    .add(l)
                  .end();

                lSection = section;
              }

              var localI    = i.valueOf();
              var localShow = foam.lang.SimpleSlot.create({value: true});

              section
                .start('span')
                  .show(localShow)
                  .addClass(self.myClass('dao'))
                  .add(label)
                  .attrs({title: spec.description})
                  .on('click', function() {
                    self.route = spec.id;
                  });

                  self.search$.sub(function() {
                    var contains = false;
                    if ( ! self.search ) {
                      contains = true;
                    } else if ( label.toLowerCase().includes(self.search.toLowerCase()) ) {
                      contains =  true;
                    } else if ( ! contains && spec.keywords && spec.keywords.length > 0 ) {
                      for ( var k in spec.keywords ) {
                        if ( k.toLowerCase().includes(self.search.toLowerCase()) ) {
                          contains  = true;
                          break;
                        }
                      }
                    }

                    if ( contains ) self.daoCount++;
                    localShow.set(contains);
                    updateSections[localI].set(! updateSections[localI].get());
                  });
            });
            self.start().addClass(self.myClass('footer')).add(self.daoCount$, ' of ', self.totalDAOCount$, ' shown').end();
          });
        }
      ]
    },
    {
      name: 'DAOUpdateControllerView',
      extends: 'foam.comics.DAOUpdateControllerView',

      documentation: 'Same as regular UpdateController except it starts in EDIT mode',

      properties: [
        {
          name: 'controllerMode',
          factory: function() {
            return this.ControllerMode.EDIT;
          }
        }
      ]
    },
    {
      name: 'CustomDAOSummaryView',
      extends: 'foam.comics.v3.DetailView',
      messages: [
        { name: 'DETAIL',    message: 'Detail' },
        { name: 'TABBED',    message: 'Tabbed' },
        { name: 'SECTIONED', message: 'Sectioned' },
        { name: 'MATERIAL',  message: 'Material' },
        { name: 'WIZARD',    message: 'Wizard' },
        { name: 'VERTICAL',  message: 'Vertical' },
        { name: 'ALL',       message: 'All ' }
      ],
      properties: [
        {
          class: 'foam.u2.ViewSpec',
          name: 'viewView',
          factory: function() {
            return {
              class: 'foam.u2.view.ObjAltView',
              views: [
                [ {class: 'foam.u2.DetailView'},                 this.DETAIL ],
                [ {class: 'foam.u2.detail.TabbedDetailView'},    this.TABBED ],
                [ {class: 'foam.u2.detail.SectionedDetailView'}, this.SECTIONED ],
                [ {class: 'foam.u2.detail.MDDetailView'},        this.MATERIAL ],
                [ {class: 'foam.u2.detail.WizardSectionsView'},  this.WIZARD ],
                [ {class: 'foam.u2.detail.VerticalDetailView'},  this.VERTICAL ]
              ],
              selectedViewLabel: this.TABBED
            };
          }
        }
      ]
    }
  ],

  properties: [
    {
      name: 'viewTitle',
      value: 'Data Management'
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      this.addCrumb();
    },

    function render() {
      this.SUPER();
      var self = this;
      // TODO: Should move to DAOView and these sub-Models should move there also
      let x = this.__subContext__;
      x.register(this.DAOUpdateControllerView, 'foam.comics.DAOUpdateControllerView');
      // TODO: Fix route handling in this view
      x.register(this.CustomDAOSummaryView,    'foam.comics.v3.DetailView');
      x.register(foam.u2.DetailView,           'foam.u2.DetailView');

      this.dynamic(function(route) {
        self.removeAllChildren(); // I don't know why this is necessary

        if ( route ) {
          this.tag(foam.comics.v3.DAOController, {data: this.__context__[route]});
        } else {
          this.tag(self.DAOListView);
        }
      });
    }
  ]
});
