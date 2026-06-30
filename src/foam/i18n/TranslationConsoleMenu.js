/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.i18n',
  name: 'TranslationConsoleMenu',
  extends: 'foam.u2.Element',

  css: `
    ^ { 
      display: flex;
      flex-direction: column;
      gap: 1rem;
      place-content: center;
      height: 100%;
      width: 100%;
      text-align: center;
    }
    ^instructions {
      display: inline-block;
      margin: 0 auto;
      max-width: 40rem;
      text-align: left;
    }
    ^instructions li {
      margin: 0.5rem 0;
    }
  `,

  requires: [
    'foam.i18n.TranslationConsole'
  ],

  messages: [
    { 
      name: 'TRANSLATION_CONSOLE_MSG', 
      messageMap: {
        en: 'The Translation Console has opened in a new tab.',
        fr: 'La console de traduction s\'est ouverte dans un nouvel onglet.'
      }
    },
    {
      name: 'TRANSLATION_CONSOLE_INSTRUCTIONS',
      messageMap: {
        en: 'How to use it:',
        fr: 'Comment l\'utiliser :'
      }
    },
    {
      name: 'INSTRUCTION_DISCOVER',
      messageMap: {
        en: 'Keep the console open and browse the app. Rendered strings are added to the console as they are discovered.',
        fr: 'Gardez la console ouverte et parcourez l\'application. Les chaînes rendues sont ajoutées à la console lorsqu\'elles sont découvertes.'
      }
    },
    {
      name: 'INSTRUCTION_LOCALE',
      messageMap: {
        en: 'Select the locale you want to edit.',
        fr: 'Sélectionnez la locale à modifier.'
      }
    },
    {
      name: 'INSTRUCTION_LOAD',
      messageMap: {
        en: 'Click Load saved translations before editing so the table shows saved values for the selected locale.',
        fr: 'Cliquez sur Charger les traductions sauvegardées avant de modifier afin que le tableau affiche les valeurs sauvegardées pour la locale sélectionnée.'
      }
    },
    {
      name: 'INSTRUCTION_SAVE',
      messageMap: {
        en: 'Edit the Translation column, then use Save for selected locale on each changed row.',
        fr: 'Modifiez la colonne Traduction, puis utilisez Enregistrer pour la locale sélectionnée sur chaque ligne modifiée.'
      }
    }
  ],
  methods: [
    function render() {
      foam.i18n.TranslationConsole.OPEN();
      this.start()
        .addClass(this.myClass())
        .add(this.TRANSLATION_CONSOLE_MSG)
        .start()
          .addClass(this.myClass('instructions'))
          .start('p').add(this.TRANSLATION_CONSOLE_INSTRUCTIONS).end()
          .start('ol')
            .start('li').add(this.INSTRUCTION_DISCOVER).end()
            .start('li').add(this.INSTRUCTION_LOCALE).end()
            .start('li').add(this.INSTRUCTION_LOAD).end()
            .start('li').add(this.INSTRUCTION_SAVE).end()
          .end()
        .end()
      .end();
    }
  ]
});
