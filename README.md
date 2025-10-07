# FOAM3

Build fully featured high performance apps in less time using FOAM.

  * Application Speed
  * Application Size
  * Developer Efficiency

"Fast apps Fast"

FOAM3 is the active version of FOAM.

The FOAM1 [website](https://foam-framework.github.io/foam/) still contains many useful demos and videos (but some links may be broken).

Ask questions and get help on the [FOAM Discussion Group](https://groups.google.com/g/foam-framework-discuss).

<!--
[![Build Status](https://travis-ci.org/foam-framework/foam3.svg?branch=master)](https://travis-ci.org/foam-framework/foam3) -->

## Feature Oriented Active Modeller

FOAM is a modeling tool and class based object system.  To use FOAM,
you create a model of your class by describing the properties, methods,
event topics, listeners, and dependencies of your class.  FOAM takes
this model and generates a usable JavaScript class along with several
companion features such as database support and network marshaling.

While FOAM is written in JavaScript, it can be used to generate code
for any language or platform, including Android Java and iOS Swift.

# Development
## Dependencies

FOAM has no runtime dependencies, but does have build dependencies:

* git
* npm
* nodejs (version >= 16)
* maven
* java (version >= 21)

Once dependencies are installed, update FOAM's javascript dependencies:
From the root of the FOAM repository, execute:

    ./build.sh --install

    sudo chown -R $USER /opt

See [INSTALL.md](INSTALL.md) for more detailed installation notes.

## Building
### Build and run Java webserver

    ./build.sh -Jdemo

* visit: http://localhost:8080
* login with username `admin` and password `admin`

`    ./build.sh`

* visit: http://localhost:8080/foam3/src/foam/demos/index.html


#### common build options:

* **-h** - help, show all options
* **-c** - clean
* **-d** - debug mode allowing connection by a remote debugger
* **-j** - delete runtime journals (use with caution)
* **-Jpom1,pom2,...,pomN** - where pomN,... are found relative to the deployment folder. 
* **-a** - build and deploy from a single Java jar file. 

## Creating and running an example Application

**NOTE: this will create a parent directory above foam3/**

    ./build.sh -T+setup/Project --appName:Example --package:com.foamdev --adminPassword:badpassword --genJava,createProject
    cd ..
    ./build.sh

* visit: http:/localhost:8080 and login with admin / badpassword

<!--
## Running Application Controller

The FOAM Application Controller allows you to access components of your foam
app by using the browser & displaying it as a GUI.
To access, run the following in the parent directory of foam3:
-->

## Remote deployment

To build and deploy to a remote linux instance

1. build: `./build.sh -ck[Jpom...]`
1. deploy: `./build.sh -TStandard,RemoteInstall,Java --user:foam user-id:3636 --remote-hostname:hostname`
1. visit: http://hostname:8080

## Style Guide

All code should follow the [style guide.](doc/guides/StyleGuide.md)

## Testing
To run all, Java and Javacript, tests from the command-line, run:
`./build.sh --run-tests`

To run individual tests from the command-line, run:
`./build.sh --run-tests:testName1,testName2,...testNameN`

<!--
* _npm test_ runs standard unit tests.

* _npm run testDebug_ runs the unit tests with a debugger.

* _npm run coverage_ runs code coverage and creates an html report in /coverage.

For in-browser testing, run your favorite web server at the root of the FOAM
repository. In a browser, navigate to
[http://localhost:8080/test/browser/SpecRunner.html](http://localhost:8000/test/browser/SpecRunner.html)
to run the unit tests.
-->
# Documentation

## Videos
- [Short Intro](https://www.youtube.com/watch?v=S4LbUv5FsGQ)
- [Medium Intro](https://www.youtube.com/watch?v=n699DWb2TUs)
- [Long Intro](https://www.youtube.com/watch?v=PsFLlgrzn2E)
- [Reactive Programming in FOAM](https://www.youtube.com/watch?v=-fbq-_H6Lf4)
- [UNIX and Google](https://www.youtube.com/watch?v=3Ea3pkTCYx4)
- [Olympic Medals Demo](https://www.youtube.com/watch?v=y9i4oW9dHHw)
- [Turtle Graphics](https://www.youtube.com/watch?v=4wO_RrftJTE)

## Guides
- [Build](doc/guides/Build.md)
- [Contexts](doc/guides/Context.md)
- [DAOs](doc/guides/Dao.md)
- [DAO Examples](doc/guides/DaoExamples.md)
- [Deployment](doc/guides/Deployment.md)
- [Easy DAO](doc/guides/EasyDao.md)
- [Enums](doc/guides/Enum.md)
- [Permissions](doc/guides/Permissions.md)
- [Project Object Models (POMs)](doc/guides/POM.md)
- [Porting](doc/guides/Porting.md)
- [Services](doc/guides/Services.md)
- [Security/Authentication](doc/guides/Security.md)
- [Tessting API](doc/guides/APITesting.md)

## Cheatsheets
- [Short Form](https://docs.google.com/document/d/1SWgtXtEjdiz12FimPKcTY0dsJ06hxGtCViZXn98PoyY/edit?usp=sharing)
- [Long Form](https://docs.google.com/document/d/1nCyHhlZGupNMBf5YW043CNCh-7fKDNO9H4LYIQVyj8Y/edit?usp=sharing)

## Tutorials
<!--
- [TODO](http://foam-framework.github.io/foam/tutorial/todo/0-intro/) (needs to be ported to FOAM3, needs fixes, even for FOAM1) -->
- [PhoneCat](https://github.com/kgrgreer/foam3/blob/development/tutorial/phonecat/0-intro.md)

## Demos
- [FOAM1 Demo Catalog](http://foam-framework.github.io/foam/foam/demos/DemoCat.html)

## Live Demos
Launch FOAM 
- [FOAM By Example](http://localhost:8080/foam3/src/foam/demos/examples/index.html)
- [Seven GUIs](http://localhost:8080/foam3/src/foam/demos/sevenguis/index.html)
- [Other Demos](http://localhost:8080/foam3/src/foam/demos/index.html)

## CORE
To run CORE, the FOAM Java Application Server, run:

    ./build.sh -Jdemo

- visit: http://localhost:8080
- login with username `admin` and password `admin`

## Example FOAM Projects
- An [Example FOAM Project](https://github.com/adamvy/example-foam-project) which shows how to consume/use FOAM from an external repository.
- [Another example FOAM Project](https://github.com/jlhughes/Journal) building on the above with more models and example data. 

## Design Patterns
The following course is not directly about FOAM, but covers material essential for understanding FOAM's design:

[Introduction to Design Patterns](https://docs.google.com/presentation/d/1kcohKD0WJHJWoJshOUpVdk-Pa3oeJMt9DTl63gWt-bo/edit)

Videos: [Part 1](https://www.youtube.com/watch?v=uslGu0kezeg), [Part2](https://www.youtube.com/watch?v=jzWjp_B7wE4), [Part 3](https://www.youtube.com/watch?v=yIfPa7yzYpQ)
