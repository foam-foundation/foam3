/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.boot',
  name: 'DAOConfigSummaryView',
  extends: 'foam.u2.Controller',
  mixins: ['foam.u2.memento.Memorable'],

  documentation: 'Data Management UI for browsing all DAOs.',

  classes: [
    {
      name: 'CustomDAOUpdateView',
      extends: 'foam.comics.v2.DAOUpdateView',

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
              ]
            };
          }
        }
      ]
    },

    // TODO: replace with UpdateView
    {
      name: 'CustomDAOSummaryView',
      extends: 'foam.comics.v2.DAOSummaryView',

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
              ]
            };
          }
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
      name: 'BackBorder',
      extends: 'foam.u2.Element',

      imports: [ 'stack' ],

      requires: [ 'foam.u2.stack.BreadcrumbView' ],

      css: `
        ^nav {
          margin-top: 32px;
          margin-left: 32px;
          margin-bottom: 16px;
        }
      `,

      properties: [
        'title',
        {
          class: 'foam.u2.ViewSpec',
          name: 'inner'
        },
        {
          name: 'viewTitle',
          factory: function() { return this.title; }
        }
      ],

      methods: [
        function render() {
          this.SUPER();

          this.
            start(this.BreadcrumbView).addClass(this.myClass('nav')).end().
            tag(this.inner);
        }
      ]
    }
  ],

  css: `
    ^ {
      padding: 6px;
    }
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
      background: $backgroundTertiary;
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
    /* TODO: scope this better so it doesn't affect nested AltViews also */
    .foam-u2-view-AltView .property-selectedView {
      margin-left: 32px;
    }
  `,

  requires: [
    'foam.comics.BrowserView',
    'foam.comics.v2.DAOBrowseControllerView',
    'foam.core.boot.CSpec',
    'foam.u2.stack.StackBlock'
  ],

  imports: [
    'cSpecDAO',
    'stack'
  ],

  messages: [
    { name: 'CONTROLLER1', message: 'Controller 1' },
    { name: 'CONTROLLER2', message: 'Controller 2' }
  ],

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
       class: 'foam.u2.ClearableSearchField',
       onKey: true
      },
      preSet: function(o, n) { this.daoCount = 0; return n; }
    },
    {
      name: 'currentDAO',
      shortName: 'route',
      memorable: true,
      postSet: function(o, n) {
        this.mementoChange();
      }
    },
    ['viewTitle', 'Data Management']
  ],

  methods: [
    function render() {
      this.SUPER();

      if ( this.currentDAO ) {
        this.mementoChange();
        return;
      }

      var self          = this;
      var currentLetter = '';
      var section;

      this.addClass().
      start().
        style({ 'height': '56px'}).
        start().
          style({ 'font-size': '2.6rem', 'width': 'fit-content', 'float': 'left', 'padding-top': '10px' }).
          add('Data Management').
        end()
        .start()
        .style({ 'width': 'fit-content', 'float': 'right', 'margin-right': '40px', 'margin-top': '12px' })
            .start(this.SEARCH).focus().end()
            .addClass('foam-u2-search-TextSearchView')
            .addClass(this.myClass('foam-u2-search-TextSearchView'))
          .end()
        .end()
      .end();

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
                self.currentDAO = spec.id;
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

     // this.mementoChange();
    }
  ],

  listeners: [
    function mementoChange() {
      /*
      if ( this.hasOwnProperty('memento_') ) {
        this.memento_.tail = null;
      }*/
      if ( ! this.currentDAO ) return;
      var x = this.__subContext__;

      x.register(this.DAOUpdateControllerView, 'foam.comics.DAOUpdateControllerView');
      x.register(this.CustomDAOSummaryView,    'foam.comics.v2.DAOSummaryView');
      x.register(this.CustomDAOUpdateView,     'foam.comics.v2.DAOUpdateView');
      x.register(foam.u2.DetailView,           'foam.u2.DetailView');

      this.stack.push(this.StackBlock.create({
        view: {
          class: this.BackBorder,
          title: 'Browse ' + this.currentDAO,
          inner: {
            class: 'foam.u2.view.AltView',
            data: this.__context__[this.currentDAO],
            views: [
              [
                {
                  class: this.BrowserView,
                  stack: this.stack
                },
                this.CONTROLLER1
              ],
              [
                {
                  class: this.DAOBrowseControllerView,
                  stack: this.stack,
                  showNav: false
                },
                this.CONTROLLER2
              ]
            ],
            selectedView: this.CONTROLLER2
          }
        }, parent: x }));
    }
  ]
});
