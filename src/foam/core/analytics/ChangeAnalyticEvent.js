/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.analytics',
  name: 'ChangeAnalyticEvent',
  extends: 'foam.core.analytics.AnalyticEvent',

  css: `
    ^pill, ^pill-before, ^pill-after, ^pill-custom-color {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px;
      font-size: 12px;
      font-weight: 600;
      line-height: 18px;
      border-radius: 12px;
      white-space: nowrap;
    }
    ^pill-before {
      background-color: $grey100;
      color: $grey500;
    }
    ^pill-after {
      background-color: $green50;
      color: $green600;
    }
    /* Subclasses of ChangeAnalyticEvent can overload pill-custom-color to change the pill color */
    ^pill-custom-color {
      background-color: $grey100;
      color: $grey500;
    }
    ^label {
      line-height: 1;
      min-height: 1em;
      width: 100%;
      font-weight: 600;
    }
    ^supportingLabel {
      line-height: 1;
      min-height: 1em;
      width: 100%;
      color: $textTertiary;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'field',
      documentation: 'The property that was changed.',
      hidden: true
    },
    {
      class: 'String',
      name: 'before',
      documentation: 'The value of whatever this AnalyticEvent was triggered on *before* the change happened.',
      tableCellFormatter: function(value, obj) {
        this.start('span')
          .addClass(foam.String.cssClassize(obj.cls_.id) + '-pill-before')
          .add(value)
        .end();
      }
    },
    {
      class: 'String',
      name: 'after',
      documentation: 'The value of whatever this AnalyticEvent was triggered on *after* the change happened.',
      tableCellFormatter: function(value, obj) {
        this.start('span')
          .addClass(foam.String.cssClassize(obj.cls_.id) + '-pill-after')
          .add(value)
        .end();
      }
    },
    {
      class: 'String',
      name: 'component',
      documentation: 'The component / category this AnalyticEvent is related to (e.g. "User Management", "Input")',
      tableCellFormatter: function(value, obj) {
        this.start('span')
          .addClass(foam.String.cssClassize(obj.cls_.id) + '-pill-custom-color')
          .add(value)
        .end();
      }
    },
    {
      class: 'String',
      name: 'changedObjPrefix',
      documentation: 'Prefix used to describe changedObjName. (e.g. objPrefix == Case && ObjName == SWAM-1 will render as: "Case SWAM-1")',
      hidden: true
    },
    {
      class: 'String',
      name: 'changedObjName',
      label: 'Object',
      documentation: 'Name / description of the object that whose field was changed',
      tableCellFormatter: function(value, obj) {
        this.start().addClass(foam.String.cssClassize(obj.cls_.id) + '-supportingLabel').add(obj.changedObjPrefix).end();
        this.start().addClass(foam.String.cssClassize(obj.cls_.id) + '-label').add(value).end();
      }
    },
    {
      // Overload spid to display their name as that is more meaningful
      name: 'spid',
      label: 'Client',
      tableCellFormatter: function(value) {
        this.__context__.capabilityDAO.find(value).then((result) => {
          if ( ! result ) {
            this.add(value); // If we can't find the name, fallback to spid
          } else {
            this.add(result.name);
          }
        });
      }
    },
    {
      // Overload userId to display the user's name, instead
      name: 'userId',
      label: 'Actor',
      tableCellFormatter: function(value) {
        this.style({ 'font-weight': '600' });
        this.__context__.userDAO.find(value).then((result) => {
          if ( ! result ) {
            this.add("Unknown");
          } else {
            this.add(result.firstName == "system" ? result.firstName : result.firstName[0] + ". " + result.lastName);
          }
        });
      }
    },
    {
      name: 'name',
      label: 'Change', // Name of event = change that occurred
      tableCellFormatter: function(value, obj) {
        this.start().addClass(foam.String.cssClassize(obj.cls_.id) + '-label').add(obj.field).end();
        this.start().addClass(foam.String.cssClassize(obj.cls_.id) + '-supportingLabel').add(value).end();
      }
    }
  ]
});