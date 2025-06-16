/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

const tasks = {};

exports.description = 'Register POM tasks for later execution.';

exports.visitPOM = function(pom) {
  if ( ! pom.tasks ) return;

  pom.tasks.forEach(t => {
    this.verbose(`[Task] registering task ${t.name} from ${pom.name}`);
    let existing = this.findTask(TOOLING_TASKS, t.name);
    if ( ! existing ) {
      // Not associated with a tooling task. This task can be executed
      // explicitly with -Xname or --name
      this.verbose(`[Task] pom ${pom} - stand-alone pom task ${t.name}\n${t}`);
    }
    var task = tasks[t.name] || [];
    t.pom = pom.name;
    task.push(t);
    tasks[t.name] = task;
  });
};

exports.end = function() {
  let count = Object.keys(tasks).length;
  this.verbose(`[Task] Registered ${count} tasks`);
};

exports.tasks = tasks;
