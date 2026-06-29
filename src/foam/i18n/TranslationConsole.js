/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.i18n',
  name: 'TranslationConsole',
  extends: 'foam.u2.Controller',

  implements: [ 'foam.mlang.Expressions' ],

  static: [
    function OPEN() {
      var title = this.TITLE;
      var w = globalThis.window.open("", title, "width=800,height=800,scrollbars=no", true);

      // I would like to close 'w' when the parent window is reloaded, but it doesn't work.
      document.body.addEventListener('beforeunload', () => w.close());

      // Reset the document to remove old content and styles
      // Reset $UID so that new styles will be re-installed
      w.document.body.innerText = '';
      w.document.head.innerHTML = '<title>' + title + '</title>';
      w.document.$UID = foam.next$UID();

      var window = foam.lang.Window.create({window: w}, ctrl);
      var v      = this.create({}, window);
      v.write(window.document);

      foam.lang.I18NString.GETTER__ = function(proto, prop, obj, key) {
        if ( obj.sourceCls_ ) {
          var source      = obj.sourceCls_.id + '.' + obj.name + '.' + prop.name;
          var translation = v.translationService.getTranslation(v.locale, source, '');
          v.onTranslation(null, null, foam.locale, source, translation, obj.instance_[key]);
        }
        return obj.instance_[key];
      };
    }
  ],

  css: `
    * {
      font-family: Roboto, sans-serif;
    }
    ^ {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.5rem 2rem 1rem 2rem;
      box-sizing: border-box;
      height: 100%;
    }
    body {
      font-family: Roboto;
      background: $backgroundTertiary;
      color: $textSecondary;
    }
    .foam-u2-table-TableView { height: auto !important; }
    ^header {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
    }
    ^headerTop {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }
    ^titleGroup {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    ^title { color: $textDefault; }
    ^description { color: $textTertiary; }
    ^actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    ^filters {
      display: grid;
      grid-template-columns: minmax(11.25rem, 1fr) minmax(8.75rem, 13.75rem) auto;
      gap: 0.75rem;
      align-items: end;
    }
    ^field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    ^fieldLabel {
      color: $textSecondary;
    }
    ^helpIcon {
      border: 1px solid $borderDefault;
      border-radius: 50%;
      color: $textTertiary;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.625rem;
      height: 0.875rem;
      margin-left: 0.25rem;
      width: 0.875rem;
    }
    ^filterToggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding-bottom: 0.375rem;
    }
    ^content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 0;
    }
    ^ .foam-u2-table-TableView-nav {
      padding-bottom: 0px;
    }
    @media only screen and (max-width: 768px) {
      ^ { padding: 1rem; }
      ^headerTop { flex-direction: column; }
      ^actions { justify-content: flex-start; }
      ^filters { grid-template-columns: 1fr; }
      ^filterToggle { padding-bottom: 0; }
    }
  `,

  messages: [
    {
      name: 'TITLE',
      messageMap: {
        en: 'Translation Console',
        fr: 'Console de traduction'
      }
    },
    {
      name: 'DESCRIPTION',
      messageMap: {
        en: 'Review discovered strings and load saved translations for the selected locale.',
        fr: 'Examinez les chaînes découvertes et chargez les traductions sauvegardées pour la locale sélectionnée.'
      }
    },
    {
      name: 'SEARCH_LABEL',
      messageMap: {
        en: 'Search',
        fr: 'Recherche'
      }
    },
    {
      name: 'LOCALE_LABEL',
      messageMap: {
        en: 'Locale',
        fr: 'Locale'
      }
    },
    {
      name: 'LOCALE_HELP',
      messageMap: {
        en: 'Changing locale does not refresh the list. Use Load saved translations to load saved rows for the selected locale.',
        fr: 'Changer la locale n\'actualise pas la liste. Utilisez Charger les traductions sauvegardées pour charger les lignes sauvegardées pour la locale sélectionnée.'
      }
    },
    {
      name: 'TRANSLATIONS_LOADED',
      messageMap: {
        en: 'Translations loaded',
        fr: 'Traductions chargées'
      }
    },
    {
      name: 'ROWS_LOADED_FOR_LOCALE',
      messageMap: {
        en: ' rows loaded for ',
        fr: ' lignes chargées pour '
      }
    },
    {
      name: 'LOAD_FAILED',
      messageMap: {
        en: 'Load failed',
        fr: 'Échec du chargement'
      }
    },
    {
      name: 'CLEAR_CONFIRM',
      messageMap: {
        en: 'Reset console list?\n\nThis clears only this console session. Saved locale entries are not deleted.',
        fr: 'Réinitialiser la liste de la console ?\n\nCela efface uniquement cette session de console. Les entrées de locale sauvegardées ne sont pas supprimées.'
      }
    }
  ],

  classes: [
    {
      name: 'Row',

      requires: [ 'foam.i18n.Locale' ],

      imports: [ 'locale', 'localeDAO', 'notify?', 'translationService' ],

      messages: [
        {
          name: 'TRANSLATION_SAVED',
          messageMap: {
            en: 'Translation saved',
            fr: 'Traduction enregistrée'
          }
        },
        {
          name: 'TRANSLATION_SAVE_FAILED',
          messageMap: {
            en: 'Translation save failed',
            fr: 'Échec de l\'enregistrement de la traduction'
          }
        }
      ],

      tableColumns: [ 'shortSource', 'defaultText', 'text', 'update' ],

      ids: [ 'source' ],

      properties: [
        {
          class: 'String',
          name: 'source',
          hidden: true,
          tableWidth: 380
        },
        {
          class: 'String',
          name: 'shortSource',
          label: 'Source',
          expression: function(source) {
            var parts = source.split('.');
            return parts.slice(Math.max(parts.length - 3, 0)).join('.');
          },
          tableCellFormatter: function(val, obj) {
            this.attrs({ title: obj.source }).add(val);
          },
          tableWidth: 220
        },
        {
          class: 'String',
          name: 'defaultText',
          label: { en: 'Default / English', fr: 'Par défaut / anglais' },
          displayWidth: 300
        },
        {
          class: 'String',
          name: 'text',
          label: { en: 'Translation', fr: 'Traduction' },
          projectionSafe: false,
          tableCellFormatter: function(val, obj, prop) {
            this.startContext({ controllerMode: foam.u2.ControllerMode.CREATE, data: obj }).add(prop).endContext();
          },
          displayWidth: 50,
          tableWidth: 400
        }
      ],

      actions: [
        function update() {
          var l = this.Locale.create({
            locale:  this.locale.substring(0, 2),
            variant: this.locale.substring(3),
            source:  this.source,
            target:  this.text
          });

          this.localeDAO.put(l);

          this.translationService.localeEntries[this.source] = this.text;
        }
      ]
    }
  ],

  imports: [
    'translationService'
  ],

  exports: [ 'locale' ],

  requires: [
    'foam.dao.MDAO',
    'foam.u2.borders.CardBorder'
  ],

  properties: [
    {
      class: 'String',
      name: 'search',
      view: {
        class: 'foam.u2.TextField',
        type: 'search',
        placeholder: { en: 'Search source or text', fr: 'Rechercher la source ou le texte' },
        onKey: true
      }
    },
    {
      name: 'dao',
      factory: function() { return this.MDAO.create({of: this.Row}); }
    },
    {
      name: 'filteredDAO',
      expression: function(search, dao) {
        search = search.trim();
        if ( search == '' ) return dao;

        return dao.where(
          this.OR(
            this.CONTAINS_IC(this.Row.SOURCE,       search),
            this.CONTAINS_IC(this.Row.DEFAULT_TEXT, search),
            this.CONTAINS_IC(this.Row.TEXT,         search)
          ));
      },
      view: 'foam.u2.table.TableView'
    },
    {
      class: 'String',
      name: 'locale',
      factory: function() { return foam.locale.substring(0,2); }
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      this.translationService.translation.sub(this.onTranslation);
    },

    function render() {
      this.
        addClass(this.myClass()).
        start(this.CardBorder).
          style({ height: '32px', display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }).
          start('span').
            style({ display: 'inline-block', 'font-size': 'larger'}).
            add('Translation Console').
          end().
          start('div').
            style({ display: 'flex', gap: '1vw' }).
            add(this.SEARCH).
            start('span').
              style({ paddingTop: '0.5em' }).
              add(' Locale: ').
            end().
            tag({class: 'foam.u2.TextField', data$: this.locale$, size: 10}).
            add(this.CLEAR).
          end().
        end().
        start(this.CardBorder, {}, this.content$).
          style({'overflow-y':'auto'}).
          style({'margin-top': '10px', height: '90%' }).
          add(this.FILTERED_DAO).
        end();
    }
  ],

  actions: [
    function clear() { this.dao.removeAll(); }
  ],

  listeners: [
    function onTranslation(_, __, locale, source, txt, defaultText) {
      this.dao.put(this.Row.create({
        source:      source,
        text:        txt,
        defaultText: defaultText
      }));
    }
  ]
});
