<flow name="Reflow" category="DOC/GUIDE" spid="foam" description="Overview of Reflow, FOAM's Jupyter-style interactive console: Console, Flow documents, Block execution, command system, dashboards." keywords="reflow,console,flow,block,dashboard,knowledge"/>

## Overview

Reflow is FOAM's **notebook-style interactive console** that enables creation of interactive documents, data analysis workflows, and visual programming environments. It provides a command-line interface where you can execute commands, visualize data, create reusable flows, and build interactive documents similar to Jupyter notebooks.

## Core Architecture

The system is built around three main components:

**1. Console** - The main controller (`foam.core.reflow.Console`) that manages execution context, scope variables, and flow state. It handles command parsing, execution, and output rendering.

**2. Flow Documents** - Persistent documents (`foam.core.reflow.Flow`) that store metadata, access control, and serialized scripts representing the document structure. Flows can be saved, loaded, and shared between users.

**3. Blocks** - Individual execution units that represent command executions with their output and nested child blocks. Each block is an accordion-style UI element that can contain output, configuration, and hierarchical nested blocks.

## Key Features

**Interactive Command Execution** - The console provides an extensible command system where commands are JavaScript functions or objects executed interactively. Built-in commands include:
- `help` - Display available commands
- `dao` - Create DAO prompt interface for data manipulation
- `upload` - Data upload interface supporting CSV, JSON, XML formats
- `flows` - List and manage saved flows
- `save`/`load` - Persist and restore flow documents

**Reactive Properties** - The system includes reactive detail views with dynamic formulas. Objects can have `reactions_`: formulas, evaluated in the flow's scope, that set a property. Each formula is re-evaluated about once a second (it polls; it does not listen for changes), and its errors are reported per property.

**Data Visualization** - Reflow includes DAO agents for visualizing data through charts and tables. The dashboard system provides bar charts, pie charts, and line charts with customizable colors and layouts.

**Hierarchical Structure** - The `Flowable` mixin provides hierarchical organization where blocks can contain nested child blocks. This enables complex document structures with collapsible sections and tree navigation.

**Scope Management** - The console maintains a combined scope of local and flow variables for command resolution. Commands can access and modify scope variables, enabling stateful interactive sessions.

## UI Components

The system includes several specialized UI components:
- **DynamicReflowComponents** - Searchable list of available commands
- **DynamicReflowData** - Collections and flows browser
- **DynamicReflowHelp** - Keyboard shortcuts reference
- **ReflowToolBar** - Toolbar controls for components, collections, flows, and help

## Notes

Reflow essentially provides an interactive programming environment within FOAM applications, similar to how Jupyter notebooks work for Python. It's particularly useful for data exploration, prototyping, and creating interactive documentation that combines code execution with rich output visualization. The system integrates deeply with FOAM's DAO system, allowing direct manipulation and visualization of data collections through the console interface.

## Source Files

The code behind each part described above, all under `src/foam/core/reflow/` unless noted:

- **`Flowable.js`** - the `Flowable` mixin: `flowName`, `flowParent`, `flowChildren`, `value`, and the child-management methods (`addFlowChild`, `removeFlowChild`, `findFlowChildByName`, `createFlowChildName`, `flowRoot`, `flattenFlow`). It also tracks `dependencies`, `locked` and `childTransient` (children of an `include` block, which are not saved with the flow).
- **`Block.js`** - `Block`, which extends `foam.u2.Accordion`, implements `Flowable` and mixes in `foam.u2.StyleConfigurator`. It exports `addValue`, `log`, `out` and `block` to the command it runs; `outputJSON()` decides which properties are saved with the flow.
- **`Console.js`** - `Console`, which extends `AbstractConsole` (a `foam.u2.Controller` that implements `Flowable` and mixes in `foam.u2.Router`). Its `eval_(cmd, opt_ignoreSelect, ignoreHistory, flowParent)` creates a block, evaluates the command against the combined local and flow scope, names the block, turns a string, number, boolean or date result into a holder object, and adds the block to its parent. A command that fails produces a `BadBlock`. The same file defines `FlowMode`, `Layout`, `ReflowHeader` and `LimitEditHeader`.
- **`Flow.js`** - `Flow`, the persisted document (id `name`), with authorization and created/modified/SPID auditing.
- **`cmd/cmds.jrl`** - the built-in commands in `commandDAO` (`help`, `dao`, `daos`, `upload`, `flows`, `save`, `load`, `include`, `cells` and others), implemented by the classes in `cmd/`.
- **`Upload.js`** - `Upload`, the CSV / JSON / XML upload component used by the `upload` command.
- **`ReactiveDetailView.js`** - the `FObject` refinement that adds `reactions_`, `addReaction()` and `startReaction_()`, and the reactive detail views that edit them.
- **`AbstractDAOAgent.js`** and the `*DAOAgent.js` files (for example `CSVDAOAgent.js`) - DAO agents that render a DAO as a table, CSV, chart and so on.
- **`dashboard/DashboardDAOAgents.js`** - the dashboard agents (`DashboardBarChartDAOAgent`, `DashboardStackedBarChartDAOAgent`, `DashboardPieChartDAOAgent`, `DashboardLineChartDAOAgent`, `DashboardMetricDAOAgent`, `DashboardCalendarChartDAOAgent`) and the `ColorMappingMixin` that supplies chart colours.
- **`FlowableTree.js`** - the tree of blocks, with drag-to-move (`moveFlowChild`, `moveFlowChildAfter`) and copy.
- **`DynamicReflowComponents.js`**, **`DynamicReflowData.js`**, **`DynamicReflowHelp.js`** - the components list (linkable commands from `commandDAO`), the collections / flows browser (DAO names from `AuthenticatedCSpecDAO`, or flow names from `flowDAO`), and the keyboard-shortcut list.
- **`control/`** - the toolbar controls (`ComponentsControl`, `CollectionsControl`, `FlowsControl`, `HelpControl`). `ComponentsControl` opens its panel in a `foam.u2.md.OverlayDropdown`; `CollectionsControl` and `FlowsControl` extend it with a `DynamicReflowData` panel.
