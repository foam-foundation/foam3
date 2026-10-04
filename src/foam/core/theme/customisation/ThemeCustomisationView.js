/**
* @license
* Copyright 2021 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

/**
 * TODO:
 * previewViews
 * rollbacks
 */

foam.CLASS({
  package: 'foam.core.theme.customisation',
  name: 'ThemeCustomisationView',
  extends: 'foam.u2.View',

  imports: [ 'subject', 'spThemeDAO', 'theme', 'ctrl' ],

  exports: [ 'controllerMode', 'data' ],

  requires: [
    'foam.u2.Tab',
    'foam.u2.Tabs',
    'foam.core.theme.customisation.ThemeComponentView',
    'foam.core.theme.customisation.ThemeFacade',
    'foam.u2.stack.BreadcrumbView',
    'foam.u2.layout.Rows',
    'foam.core.theme.Theme',
    'foam.layout.SectionAxiom',
    'foam.layout.Section',
    'foam.u2.borders.CardBorder'
  ],

  css: `
    << {
      padding: 32px;
    }
    <<container > * + * {
      margin-top: 32px;
    }
    <<button {
      align-self: flex-end;
    }
    <<sectionWrapper {
      display: flex;
      flex-direction: column;
    }
    <<sectionWrapper > * + * {
      margin-top: 8px;
    }
  `,

  messages: [
    { name: 'THEME_MSG',   message: 'Theme' },
    { name: 'UPDATED_MSG', message: 'updated' },
    { name: 'ERROR_MSG',   message: 'Error' }
  ],

  properties: [
    {
      name: 'data',
      visibility: 'HIDDEN',
      factory: function() {
        this.ThemeFacade.create();
      }
    },
    {
      class: 'String',
      name: 'themeName'
    },
    {
      class: 'Map',
      name: 'propViews_',
      visibility: 'HIDDEN'
    }
  ],

  methods: [
    async function render() {
      if ( foam.String.isInstance(this.themeName) ) {
        var themeObj = await this.spThemeDAO.find(this.themeName);
      }
      this.data = this.ThemeFacade.create().copyFrom(themeObj);
      var self = this;
      this
      .addClass(this.myClass())
      .start(this.Rows)
        .addClass(this.myClass('container'))
        .tag(self.BreadcrumbView)
        .start()
          .add(`${this.data.name} ${this.THEME_MSG}`)
          .addClass('h100')
        .end()
          .start(this.Tabs)
            .forEach(this.ThemeFacade.getAxiomsByClass(this.SectionAxiom), function(section) {
              var a = self.Section.create().fromSectionAxiom(section, self.ThemeFacade);
              if ( ! a.properties.length ) return;
              this.start(self.Tab, { label: section.title })
                .start(self.CardBorder)
                  .addClass(self.myClass('sectionWrapper'))
                  .forEach(a.properties, function(prop) {
                    var tmpSlot = foam.lang.SimpleSlot.create({}, self);
                    this.tag(prop.view, { themeProp: prop, data$: self.data$ }, tmpSlot);
                    if ( self.propViews_[section.name] ) {
                      self.propViews_[section.name] = self.propViews_[section.name].concat(tmpSlot);
                    } else {
                      self.propViews_[section.name] = [tmpSlot];
                    }
                  })
                  .startContext({ data: self, section: section.name })
                    .start(self.SAVE, { buttonStyle: 'PRIMARY' })
                      .addClass(self.myClass('button'))
                    .end()
                  .endContext()
                .end()
              .end();
            })
          .end()
      .end();
    }
  ],

  actions: [
    {
      name: 'save',
      code: async function(X) {
        // Call propview saves for this section and then
        var errors = [];
        var self   = this;
        for ( a of this.propViews_[X.section] ) {
          if ( ! a.value.save ) return;
          try {
            await a.value.save.call(a.value);
          } catch (e) {
            errors.push(e);
          }
        }
        if ( errors.length ) return;
        // Put to theme DAO
        var themeObj = await this.spThemeDAO.find(this.themeName);
        themeObj = themeObj.copyFrom(self.data);
        try {
          await self.spThemeDAO.put(themeObj);
          self.ctrl.fetchTheme();
          self.ctrl.notify(`${themeObj.name} ${this.UPDATED_MSG}`, '', 'INFO', true);
        } catch (e) {
          self.ctrl.notify(this.ERROR_MSG, e.mesasge, 'ERROR', true);
        }
      }
    }
  ]
});
