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

      imports: [ 'locale', 'localeDAO', 'notify?', 'parsedLocale', 'translationService' ],

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
        {
          name: 'update',
          label: { en: 'Save for selected locale', fr: 'Enregistrer pour la locale sélectionnée' },
          code: async function() {
            // TODO: Look into handling theme-specific translations
            var selectedLocale = this.parsedLocale;
            var activeVariant = this.translationService.variant || '';

            // Row saves always target the locale currently selected in the console,
            // not the app's global foam.locale.
            var l = this.Locale.create({
              locale:  selectedLocale.locale,
              variant: selectedLocale.variant,
              source:  this.source,
              target:  this.text
            });

            try {
              await this.localeDAO.put(l);
              // Only update the live app cache when saving for the app's current locale.
              // Otherwise, just save the selected locale row to localeDAO.
              if ( selectedLocale.locale === this.translationService.locale &&
                   selectedLocale.variant === activeVariant ) {
                this.translationService.localeEntries[this.source] = this.text;
              }
              this.notify && this.notify(this.TRANSLATION_SAVED, this.source, 'INFO', true);
            } catch (e) {
              this.notify && this.notify(this.TRANSLATION_SAVE_FAILED, e.message || e, 'ERROR', true);
              throw e;
            }
          }
        }
      ]
    }
  ],

  imports: [
    // Drives the locale picker; only enabled languages are shown.
    'languageDAO',
    'localeDAO',
    'notify?',
    'translationService',
    'window'    // todo - replace this with better CONFIRMATION dialog
  ],

  exports: [ 'locale', 'parsedLocale' ],

  requires: [
    'foam.dao.MDAO',
    'foam.core.auth.Language',
    'foam.i18n.Locale',
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
      // Visible table state. This is rebuilt when loading saved translations.
      factory: function() { return this.MDAO.create({of: this.Row}); }
    },
    {
      name: 'discoveredDAO',
      // Session memory of strings seen by the console. Kept separate so reloads
      // can reset the table without losing untranslated discovered strings.
      factory: function() { return this.MDAO.create({of: this.Row}); }
    },
    {
      name: 'filteredDAO',
      expression: function(search, showOnlyUntranslated, dao) {
        search = search.trim();
        var predicate = this.TRUE;

        if ( search != '' ) {
          predicate = this.AND(predicate, this.OR(
            this.CONTAINS_IC(this.Row.SOURCE,       search),
            this.CONTAINS_IC(this.Row.SHORT_SOURCE, search),
            this.CONTAINS_IC(this.Row.DEFAULT_TEXT, search),
            this.CONTAINS_IC(this.Row.TEXT,         search)
          ));
        }

        if ( showOnlyUntranslated ) {
          predicate = this.AND(predicate, this.FUNC(function(row) {
            return ! row.text || ( row.defaultText && row.text === row.defaultText );
          }));
        }

        return dao.where(predicate);
      },
      view: 'foam.u2.table.TableView'
    },
    {
      class: 'String',
      name: 'locale',
      // TODO: On locale change, reload saved translations automatically. Current
      // UX footgun: users can edit discovered rows before loading the selected
      // locale's saved values.
      factory: function() { return foam.locale || 'en'; }
    },
    {
      name: 'parsedLocale',
      expression: function(locale) {
        locale = (locale || '').split('-');
        return {
          locale:  locale[0] || foam.locale.substring(0, 2),
          variant: locale[1] || ''
        };
      }
    },
    {
      class: 'Boolean',
      name: 'showOnlyUntranslated',
      label: { en: 'Show missing/default translations', fr: 'Afficher les traductions manquantes/par défaut' },
      documentation: 'Filters the visible table to rows with no translation or rows where the translation still matches the default text. Discovery and saving still work normally.'
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
          addClass(this.myClass('header')).
          start().
            addClass(this.myClass('headerTop')).
            start().
              addClass(this.myClass('titleGroup')).
              start().addClass(this.myClass('title'), 'h100').add(this.TITLE).end().
              start().addClass(this.myClass('description'), 'p').add(this.DESCRIPTION).end().
            end().
            start().
              addClass(this.myClass('actions')).
              startContext({ data: this }).
                tag(this.LOAD_ALL).
                tag(this.CLEAR, { isDestructive: true }).
              endContext().
            end().
          end().
          start().
            addClass(this.myClass('filters')).
            start().
              addClass(this.myClass('field')).
              start().addClass(this.myClass('fieldLabel'), 'p-legal-light').add(this.SEARCH_LABEL).end().
              tag(this.SEARCH, { data$: this.search$ }).
            end().
            start().
              addClass(this.myClass('field')).
              start().addClass(this.myClass('fieldLabel'), 'p-legal-light').
                add(this.LOCALE_LABEL).
                start('', { tooltip: this.LOCALE_HELP }).
                  addClass(this.myClass('helpIcon')).
                  add('?').
                end().
              end().
              start().
                tag({
                  class: 'foam.u2.view.ChoiceView',
                  data$: this.locale$,
                  dao: this.languageDAO.where(this.EQ(this.Language.ENABLED, true)),
                  objToChoice: function(language) {
                    var id = language.toString();
                    return [ id, id ];
                  }
                }).
              end().
            end().
            start().
              addClass(this.myClass('filterToggle')).
              tag(this.SHOW_ONLY_UNTRANSLATED, { data$: this.showOnlyUntranslated$, showLabel: false }).
              start().addClass('p').add(this.SHOW_ONLY_UNTRANSLATED.label).end().
            end().
          end().
        end().
        start(this.CardBorder, {}, this.content$).
          addClass(this.myClass('content')).
          add(this.FILTERED_DAO).
        end();
    },

    async function findDefaultText_(source, existing) {
      if ( existing && existing.defaultText ) return existing.defaultText;

      // Locale rows only store target text. For saved non-English rows, look up
      // the matching English row so translators can compare source and target.
      var rows = (await this.localeDAO.where(this.AND(
        this.EQ(this.Locale.LOCALE, 'en'),
        this.EQ(this.Locale.VARIANT, ''),
        this.EQ(this.Locale.THEME_ID, ''),
        this.EQ(this.Locale.SOURCE, source)
      )).select()).array;

      return rows.length ? rows[0].target : '';
    }
  ],

  actions: [
    {
      name: 'loadAll',
      label: { en: 'Load saved translations', fr: 'Charger les traductions sauvegardées' },
      buttonStyle: 'PRIMARY',
      code: async function() {
        var parsed = this.parsedLocale;
        var count  = 0;

        try {
          await this.dao.removeAll();

          // Rebuild visible rows from discovered strings first, then overlay
          // saved localeDAO rows by source so translations fill matching rows.
          var discoveredRows = (await this.discoveredDAO.select()).array;

          for ( var i = 0 ; i < discoveredRows.length ; i++ ) {
            var row = discoveredRows[i];
            this.dao.put(this.Row.create({
              source:      row.source,
              text:        '',
              defaultText: row.defaultText
            }));
          }

          var rows = (await this.localeDAO.where(this.AND(
            this.EQ(this.Locale.LOCALE, parsed.locale),
            this.EQ(this.Locale.VARIANT, parsed.variant),
            // TODO: Look into handling theme-specific translations
            // The console saves global rows. Exclude theme rows so users don't
            // edit a theme-specific value and save it to the global fallback.
            this.EQ(this.Locale.THEME_ID, '')
          )).select()).array;

          for ( var i = 0 ; i < rows.length ; i++ ) {
            var l           = rows[i];
            var existing    = await this.dao.find(l.source);
            var isEnglish   = parsed.locale == 'en' && parsed.variant == '';
            var defaultText = isEnglish ? l.target : await this.findDefaultText_(l.source, existing);
            count++;
            this.dao.put(this.Row.create({
              source:      l.source,
              text:        l.target,
              defaultText: defaultText
            }));
          }
          this.notify && this.notify(this.TRANSLATIONS_LOADED, count + this.ROWS_LOADED_FOR_LOCALE + this.locale, 'INFO', true);
        } catch (e) {
          this.notify && this.notify(this.LOAD_FAILED, e.message || e, 'ERROR', true);
          throw e;
        }
      }
    },
    {
      name: 'clear',
      label: { en: 'Reset console list', fr: 'Réinitialiser la liste de la console' },
      code: function() {
        if ( ! this.window.confirm(this.CLEAR_CONFIRM) ) return;
        this.discoveredDAO.removeAll();
        this.dao.removeAll();
      }
    }
  ],

  listeners: [
    function onTranslation(_, __, locale, source, txt, defaultText) {
      // Translation events are the discovery path. Store them both in the visible
      // table and in the session baseline used when reloading saved translations.
      var row = this.Row.create({
        source:      source,
        text:        txt,
        defaultText: defaultText
      });
      this.discoveredDAO.put(row);
      this.dao.put(row);
    }
  ]
});
