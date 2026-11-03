/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

foam.CLASS({
  package: 'foam.comics',
  name: 'DAOCreateControllerView',
  extends: 'foam.u2.View',

  requires: [
    'foam.comics.DAOCreateController',
    'foam.log.LogLevel',
    'foam.core.notification.Notification',
    'foam.core.notification.ToastState',
    'foam.u2.DisplayMode'
  ],

  imports: [
    'dao',
    'notify',
    'stack'
  ],

  exports: [
    'data'
  ],

  css: `
    << {
      width: 1024px;
      margin: auto;
    }
    <<action-container {
      display: flex;
      justify-content: space-between;
      margin: 8px 0;
    }
    <<action-container > div > div > * + * {
      margin-left: 8px;
    }
    <<detail-container {
      overflow-x: auto;
    }
  `,

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.comics.DAOCreateController',
      name: 'data',
      factory: function() {
        return this.DAOCreateController.create({ dao: this.dao });
      }
    },
    {
      class: 'String',
      name: 'title',
      expression: function(data$dao$of) {
        return 'Create ' + data$dao$of.name;
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'detailView'
    }
  ],

  methods: [
    function render() {
      this
        .addClass(this.myClass())

        // Container for the actions
        .start()
          .addClass(this.myClass('action-container'))

          // Actions grouped to the left
          .start()
            .startContext({ data: this })
              .tag(this.CANCEL)
            .endContext()
          .end()

          // Actions grouped to the right
          .start()
            .start()
              .show(this.mode$.map((m) => m === this.DisplayMode.RW))
              .add(this.data.cls_.getAxiomsByClass(foam.lang.Action))
            .end()
          .end()
        .end()

        // Container for the detailview
        .start()
          .addClass(this.myClass('detail-container'))
          .tag({
            class: 'foam.u2.view.FObjectView',
            of: this.dao.of,
            data$: this.data$.dot('data'),
            dataView: this.detailView
          })
        .end();
    }
  ],

  actions: [
    {
      name: 'cancel',
      code: function() {
        this.stack.back();
      }
    }
  ],

  listeners: [
    {
      name: 'onFinished',
      on: [
        'data.finished'
      ],
      code: function() {
        this.stack.back();
      }
    },
    {
      name: 'onThrowError',
      on: [
        'data.throwError'
      ],
      code: function() {
        var self = this;
        self.notify(self.data.exception.message, '', self.LogLevel.ERROR, true);
      }
    },
  ]
});
